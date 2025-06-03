from flask import Flask, jsonify, render_template, request
import json
import os
from db import connect_to_mongodb, extract_chat_histories, save_to_json, MONGO_CLIENT, MONGO_COLLECTION
from api.analytics import analytics

# Initialize MongoDB once at startup
db_client, _ = connect_to_mongodb()
if db_client is None:
    raise RuntimeError('Failed to connect to MongoDB')
db = db_client[MONGO_CLIENT]

app = Flask(__name__, static_folder='static')
app.register_blueprint(analytics, url_prefix='/api')

# Path to the JSON file containing chat histories
# .
def load_chat_data():
    """Load chat data directly from MongoDB"""
    try:
        # Connect to MongoDB and extract data
        # We're using the global db_client that was initialized at startup
        # instead of creating a new connection each time
        collection = db_client[MONGO_CLIENT][MONGO_COLLECTION]
        
        if collection is not None:
            print("Fetching chat data directly from MongoDB...")
            chat_data = extract_chat_histories(collection)
            
            if chat_data and len(chat_data) > 0:
                print(f"Successfully loaded data for {len(chat_data)} users from MongoDB")
                return chat_data
            else:
                print("No chat data found in MongoDB")
                return {}
        else:
            print("Could not access MongoDB collection")
            return {}
    except Exception as e:
        print(f"Error loading chat data from MongoDB: {e}")
        # Return empty dict instead of None to avoid further errors
        return {}

@app.route('/')
def index():
    # Redirect to the React app
    return "API is running. Frontend is available at http://localhost:8080"

@app.route('/api/users')
def get_users():
    chat_data = load_chat_data()
    if not chat_data:
        return jsonify([]), 200
    
    user_list = []
    
    # Use the MongoDB collection directly to ensure we only get entities with user_id
    collection = db_client[MONGO_CLIENT][MONGO_COLLECTION]
    users = collection.find({"userid": {"$exists": True, "$ne": None, "$ne": ""}})
    
    for user in users:
        user_id = str(user.get('userid'))
        # Only add users with valid user_id
        if user_id and user_id != "None":
            user_list.append({"id": user_id})
            print(f"Found user with valid user_id: {user_id}")
    
    return jsonify(user_list)


@app.route('/api/users/<user_id>/sessions')
def get_user_sessions(user_id):
    chat_data = load_chat_data()
    if not chat_data:
        return jsonify([]), 200

    # Check if user exists in our data
    if user_id not in chat_data:
        print(f"User not found: {user_id}")
        return jsonify([]), 200
    
    print(f"Found user: {user_id}")
    session_list = []
    
    # Get all sessions for this user
    for session_id in chat_data[user_id].keys():
        session_data = chat_data[user_id][session_id]
        
        # Check if this session uses the new schema format
        if 'chat_history' not in session_data:
            print(f"Skipping session {session_id} - old schema format")
            continue
            
        messages = session_data.get('chat_history', [])
        
        # Calculate message count and timestamps
        message_count = len(messages)
        created_at = "Unknown"
        last_activity = "Unknown"
        
        if message_count > 0:
            # Try to get timestamps
            if messages[0].get('timestamp'):
                timestamp = messages[0].get('timestamp')
                if isinstance(timestamp, dict) and '$date' in timestamp:
                    created_at = timestamp['$date']
                else:
                    created_at = str(timestamp)
            
            if messages[-1].get('timestamp'):
                timestamp = messages[-1].get('timestamp')
                if isinstance(timestamp, dict) and '$date' in timestamp:
                    last_activity = timestamp['$date']
                else:
                    last_activity = str(timestamp)
        
        session_list.append({
            "id": session_id,
            "messageCount": message_count,
            "createdAt": created_at,
            "lastActivity": last_activity
        })
        print(f"Found session with new schema: {session_id} with {message_count} messages")
    
    return jsonify(session_list)


@app.route('/api/users/<user_id>/sessions/<session_id>')
def get_session_chat(user_id, session_id):
    chat_data = load_chat_data()
    if not chat_data:
        return jsonify([]), 200
    
    # Check if user exists
    if user_id not in chat_data:
        return jsonify([]), 200
    
    # Check if session exists for this user
    if session_id not in chat_data[user_id]:
        return jsonify([]), 200
    
    # Merge with feedback DB
    session_data = chat_data[user_id][session_id]
    raw_msgs = session_data.get('chat_history', [])
    projects = session_data.get('projects', [])
    tasks = session_data.get('tasks', [])
    email_thread_chain = session_data.get('email_thread_chain', [])
    email_thread_id = session_data.get('email_thread_id', None)
    fb_coll = db['alfred_feedback']
    
    # Build or extract message_ids
    msg_ids = [m.get('message_id') or f"{user_id}_{session_id}_{i}" for i, m in enumerate(raw_msgs)]
    
    # Fetch existing feedback documents
    # Try looking up feedback by both _id and message_id fields
    fb_docs_by_id = list(fb_coll.find({'_id': {'$in': msg_ids}}))
    fb_docs_by_msg_id = list(fb_coll.find({'message_id': {'$in': msg_ids}}))
    
    # Combine the results, prioritizing _id matches
    fb_map = {doc['_id']: doc for doc in fb_docs_by_id}
    
    # Add message_id matches only if _id match doesn't exist
    for doc in fb_docs_by_msg_id:
        msg_id = doc['message_id']
        if msg_id not in fb_map:
            fb_map[msg_id] = doc
    
    print(f"Found {len(fb_map)} feedback documents for this session")
    
    # Merge messages with feedback
    merged_msgs = []
    for i, m in enumerate(raw_msgs):
        msg_id = m.get('message_id')
        if not msg_id:
            msg_id = f"{user_id}_{session_id}_{i}"
            m['message_id'] = msg_id  # Set it for future use
            
        ts = m.get('timestamp', 'Unknown time')
        if isinstance(ts, dict) and 'date' in ts:
            ts = ts['date']
        # Normalize timestamp to ISO string if datetime object
        if hasattr(ts, 'isoformat'):
            ts = ts.isoformat()

        # Get feedback data for this message
        fb_doc = fb_map.get(msg_id, {})
        feedback = fb_doc.get('feedback')
        comments = fb_doc.get('comments', [])
        
        for role in m.get('messages', []):
            role_data = role.get('role')
            content = role.get('content')
            
            # Only include function_name and function_response for assistant messages
            function_name = None
            function_response = None
            
            if role_data == 'assistant':
                # Look for function messages
                for func_msg in m.get('messages', []):
                    if func_msg.get('role') == 'function':
                        function_name = func_msg.get('name')
                        function_response = func_msg.get('content')
            
            msg_data = {
                'id': msg_id,
                'message_id': msg_id,  # Include both for compatibility
                'role': role_data,
                'content': content,
                'timestamp': ts,
                'sequence': m.get('sequence', i),
                'feedback': feedback,
                'comments': comments,
                'function_name': function_name,
                'function_response': function_response
            }
            merged_msgs.append(msg_data)
    
    # Sort messages by sequence number first (most reliable), then by timestamp as fallback
    try:
        # First try to sort by sequence number which is most reliable
        merged_msgs.sort(key=lambda x: x.get('sequence', float('inf')))
    except Exception as e:
        print(f"Error sorting messages by sequence: {e}")
        # Fallback: try to sort by timestamp
        try:
            merged_msgs.sort(key=lambda x: x.get('timestamp', ''))
        except Exception as e:
            print(f"Error sorting messages by timestamp: {e}")

    # Return all structured session data to frontend
    return jsonify({
        'messages': merged_msgs,
        'projects': projects,
        'tasks': tasks,
        'email_thread_chain': email_thread_chain,
        'email_thread_id': email_thread_id
    })

@app.route('/api/interactions')
def get_interactions():
    chat_data = load_chat_data()
    if not chat_data:
        print("No chat data available, returning empty list")
        return jsonify([]), 200
    
    interactions = []
    try:
        for user_id, sessions in chat_data.items():
            for session_id, session_data in sessions.items():
                # Check if session uses the new schema format
                if 'chat_history' not in session_data:
                    continue
                    
                chat_history = session_data['chat_history']
                
                if not chat_history or not isinstance(chat_history, list):
                    continue
                
                print(f"Processing session {session_id} with {len(chat_history)} chat history items")
                
                # Process each message in the chat history
                for message in chat_history:
                    # Validate message structure
                    if not isinstance(message, dict) or 'messages' not in message:
                        continue
                    
                    message_id = message.get('message_id')
                    timestamp = message.get('timestamp')
                    messages_list = message.get('messages', [])
                    
                    # Ensure timestamp is a string
                    if isinstance(timestamp, dict) and '$date' in timestamp:
                        timestamp = timestamp['$date']
                    elif hasattr(timestamp, 'isoformat'):  # Python datetime object
                        timestamp = timestamp.isoformat()
                    
                    # Find user and assistant messages
                    user_content = None
                    assistant_content = None
                    function_name = None
                    function_response = None
                    
                    for msg in messages_list:
                        if msg.get('role') == 'user':
                            user_content = msg.get('content')
                        elif msg.get('role') == 'assistant':
                            assistant_content = msg.get('content')
                        elif msg.get('role') == 'function':
                            function_name = msg.get('name')
                            function_response = msg.get('content')
                    
                    # Only add to interactions if we have both user and assistant content
                    if user_content and assistant_content:
                        interactions.append({
                            'id': message_id,  # Keep using 'id' for frontend compatibility
                            'userPrompt': user_content,
                            'aiResponse': assistant_content,
                            'timestamp': str(timestamp),
                            'agents': [],
                            'function_name': function_name,
                            'function_response': function_response,
                            'rating': None,
                            'comments': [],
                            'user': {
                                'name': user_id,
                                'avatar': ''
                            }
                        })
    
    except Exception as e:
        print(f"Error formatting interactions: {e}")
        import traceback
        traceback.print_exc()
    
    # Merge stored feedback/comments from DB
    try:
        fb_coll = db['alfred_feedback']
        
        # Create a list of message IDs to query
        msg_ids = [item['id'] for item in interactions if item['id']]
        
        if msg_ids:
            # Try looking up feedback by both _id and message_id fields
            fb_docs_by_id = list(fb_coll.find({'_id': {'$in': msg_ids}}))
            fb_docs_by_msg_id = list(fb_coll.find({'message_id': {'$in': msg_ids}}))
            
            # Combine the results, prioritizing _id matches
            fb_map = {doc['_id']: doc for doc in fb_docs_by_id}
            
            # Add message_id matches only if _id match doesn't exist
            for doc in fb_docs_by_msg_id:
                msg_id = doc['message_id']
                if msg_id not in fb_map:
                    fb_map[msg_id] = doc
            
            # Update interactions with feedback data
            for item in interactions:
                if not item['id']:
                    continue
                    
                doc = fb_map.get(item['id'], {})
                # override defaults if present
                item['rating'] = doc.get('feedback', item.get('rating'))
                item['comments'] = doc.get('comments', item.get('comments', []))
                
                print(f"Message {item['id']}: rating={item['rating']}, comments={item['comments']}")
    except Exception as e:
        print(f"Error merging feedback: {e}")
        import traceback
        traceback.print_exc()
    
    print(f"Returning {len(interactions)} interactions with persisted feedback")
    return jsonify(interactions)

@app.route('/api/chat_histories')
def chat_histories():
    chat_data = load_chat_data()
    if chat_data is None:
        return jsonify({"error": "Could not load chat data"}), 500
    
    return jsonify(chat_data)

@app.route('/api/comments', methods=['POST'])
def add_comment():
    data = request.get_json()
    print(f"Received comment data: {data}")
    
    # Get the message_id which will now be used as _id
    doc_id = data.get('message_id')
        
    comment = data.get('comment')
    rating = data.get('rating')
    has_comment = 'comment' in data
    has_rating = 'rating' in data
    
    # Basic validation
    if not doc_id:
        return jsonify({'error': 'message_id required'}), 400
    if has_rating and rating not in ('good','bad','neutral', None):
        return jsonify({'error': 'Invalid rating value'}), 400
    if has_comment and comment is not None and not isinstance(comment, str):
        return jsonify({'error': 'Comment must be a string'}), 400

    collection = db['alfred_feedback']

    try:
        ops = {}
        if has_comment and comment:
            ops.setdefault('$push', {})['comments'] = comment
        if has_rating:
            ops.setdefault('$set', {})['feedback'] = rating
            
        # Only create a new document if we actually have changes to make
        if ops:
            # Find the message in email_threads to copy its data
            message_data = get_message_data(doc_id)
            
            # Set the operation to create new documents with data from email_threads
            if message_data:
                # For each role, add the corresponding content
                for role_data in message_data.get('roles', []):
                    role = role_data.get('role')
                    if role == 'user':
                        ops.setdefault('$setOnInsert', {})['user'] = role_data.get('content', '')
                    elif role == 'assistant':
                        ops.setdefault('$setOnInsert', {})['assistant'] = role_data.get('content', '')
                    elif role == 'function':
                        ops.setdefault('$setOnInsert', {})['function_name'] = role_data.get('name', '')
                        ops.setdefault('$setOnInsert', {})['function_response'] = role_data.get('content', '')
            
            # Use update with upsert to create or modify the document
            result = collection.update_one(
                {'_id': doc_id},  # Use message_id as _id
                ops,
                upsert=True
            )

        return jsonify({'success': True}), 200
    except Exception as e:
        print(f"Error saving comment: {e}")
        return jsonify({'error': str(e)}), 500


def get_message_data(message_id):
    """
    Extracts message data from email_threads collection based on message_id
    """
    try:
        # Load chat data
        chat_data = load_chat_data()
        
        # Search for the message with the given ID
        for user_id, user_data in chat_data.items():
            for session_id, session_data in user_data.get('sessions', {}).items():
                chat_history = session_data.get('chat_history', [])
                
                for chat_item in chat_history:
                    if chat_item.get('message_id') == message_id:
                        # Found the message
                        return {
                            'timestamp': chat_item.get('timestamp'),
                            'roles': [
                                {
                                    'role': msg.get('role'),
                                    'content': msg.get('content', ''),
                                    'name': msg.get('name', '') if msg.get('role') == 'function' else None
                                }
                                for msg in chat_item.get('messages', [])
                            ]
                        }
        
        # Message not found
        print(f"Message with ID {message_id} not found in chat data")
        return {}
    
    except Exception as e:
        print(f"Error retrieving message data: {e}")
        return {}

@app.route('/api/message/<message_id>')
def get_message_feedback(message_id):
    try:
        # Query feedback collection using message_id as _id
        fb_coll = db['alfred_feedback']
        doc = fb_coll.find_one({'_id': message_id})
        
        if not doc:
            # If no feedback document exists with the message_id as _id,
            # try looking it up by message_id field (for backward compatibility)
            doc = fb_coll.find_one({'message_id': message_id})
        
        # Get original message data
        message_data = get_message_data(message_id)
        
        # Prepare response, merging feedback data with original message data
        response = {
            'id': message_id,
            'feedback': doc.get('feedback') if doc else None,
            'comments': doc.get('comments', []) if doc else [],
            'timestamp': message_data.get('timestamp')
        }
        
        # Add role-specific content if available
        for role_data in message_data.get('roles', []):
            role = role_data.get('role')
            if role == 'user':
                response['user'] = role_data.get('content')
            elif role == 'assistant':
                response['assistant'] = role_data.get('content')
            elif role == 'function':
                response['function_name'] = role_data.get('name')
                response['function_response'] = role_data.get('content')
        
        return jsonify(response), 200
    
    except Exception as e:
        print(f"Error retrieving message feedback: {e}")
        return jsonify({"error": str(e)}), 500

@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE')
    return response

if __name__ == '__main__':
    # Use a different port than the React app
    app.run(debug=True, port=3002)
