from flask import Flask, jsonify, render_template, request
import json
import os
from db import connect_to_mongodb, extract_chat_histories, save_to_json, MONGO_CLIENT, MONGO_COLLECTION

# Initialize MongoDB once at startup
db_client, _ = connect_to_mongodb()
if db_client is None:
    raise RuntimeError('Failed to connect to MongoDB')
db = db_client[MONGO_CLIENT]

app = Flask(__name__, static_folder='static')

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
    for user_id in chat_data.keys():
        user_list.append({"id": str(user_id)})
        print(f"Found user: {user_id}")
    
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
        messages = chat_data[user_id][session_id]
        # Calculate message count and timestamps
        message_count = len(messages)
        created_at = "Unknown"
        last_activity = "Unknown"
        
        if message_count > 0:
            # Try to get timestamps
            if messages[0].get('timestamp'):
                timestamp = messages[0].get('timestamp')
                if isinstance(timestamp, dict) and 'date' in timestamp:
                    created_at = timestamp['date']
                else:
                    created_at = str(timestamp)
            
            if messages[-1].get('timestamp'):
                timestamp = messages[-1].get('timestamp')
                if isinstance(timestamp, dict) and 'date' in timestamp:
                    last_activity = timestamp['date']
                else:
                    last_activity = str(timestamp)
        
        session_list.append({
            "id": session_id,
            "messageCount": message_count,
            "createdAt": created_at,
            "lastActivity": last_activity
        })
        print(f"Found session: {session_id} with {message_count} messages")
    
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
    raw_msgs = chat_data[user_id][session_id]
    fb_coll = db['alfred_feedback']
    
    # build or extract message_ids
    msg_ids = [m.get('message_id') or f"{user_id}_{session_id}_{i}" for i, m in enumerate(raw_msgs)]
    print(f"Message IDs for session {session_id}: {msg_ids}")
    
    # Ensure a DB entry exists for each message with default feedback and comments
    for msg_id in msg_ids:
        fb_coll.update_one(
            {'message_id': msg_id},
            {'$setOnInsert': {'message_id': msg_id, 'feedback': None, 'comments': []}},
            upsert=True
        )
    
    # Fetch all feedback documents for these messages
    fb_docs = list(fb_coll.find({'message_id': {'$in': msg_ids}}))
    print(f"Found {len(fb_docs)} feedback documents in MongoDB")
    for doc in fb_docs:
        print(f"Feedback doc: {doc['message_id']} - feedback: {doc.get('feedback')}, comments: {doc.get('comments')}")
    
    # Map feedback docs by message_id
    fb_map = {doc['message_id']: doc for doc in fb_docs}
    
    # Merge messages with feedback
    merged = []
    for i, m in enumerate(raw_msgs):
        msg_id = m.get('message_id') or msg_ids[i]
        ts = m.get('timestamp', 'Unknown time')
        if isinstance(ts, dict) and 'date' in ts:
            ts = ts['date']
        
        # Get feedback doc or empty dict if not found
        doc_fb = fb_map.get(msg_id, {})
        
        # Create merged message with all data
        msg_data = {
            'id': msg_id,
            'role': m.get('role', 'unknown'),
            'content': m.get('content', ''),
            'timestamp': ts,
            'feedback': doc_fb.get('feedback'),
            'comments': doc_fb.get('comments', [])
        }
        
        print(f"Merged message {i}: {msg_id} - role: {msg_data['role']}, comments: {msg_data['comments']}")
        merged.append(msg_data)
    return jsonify(merged)

@app.route('/api/chat_histories')
def chat_histories():
    chat_data = load_chat_data()
    if chat_data is None:
        return jsonify({"error": "Could not load chat data"}), 500
    
    return jsonify(chat_data)

@app.route('/api/interactions')
def get_interactions():
    chat_data = load_chat_data()
    if not chat_data:  # Empty dict or None
        # Return empty list instead of error to avoid frontend issues
        print("No chat data available, returning empty list")
        return jsonify([]), 200
    
    # Format data for the frontend interactions component
    interactions = []
    try:
        for user_id, sessions in chat_data.items():
            for session_id, messages in sessions.items():
                for i, message in enumerate(messages):
                    if i + 1 < len(messages):
                        if message.get('role') == 'user' and messages[i+1].get('role') == 'assistant':
                            # Format timestamp if available
                            timestamp = message.get('timestamp', 'Unknown time')
                            if isinstance(timestamp, dict) and 'date' in timestamp:
                                timestamp = timestamp['date']
                                
                            interactions.append({
                                'id': f"{user_id}_{session_id}_{i}",
                                'userPrompt': message.get('content', ''),
                                'aiResponse': messages[i+1].get('content', ''),
                                'timestamp': timestamp,
                                'agents': message.get('agents', []),
                                'rating': None,
                                'comments': [],
                                'user': {
                                    'name': user_id,
                                    'avatar': ''
                                }
                            })
    except Exception as e:
        print(f"Error formatting interactions: {e}")
    
    # Merge stored feedback/comments from DB
    fb_coll = db['alfred_feedback']
    ids = [item['id'] for item in interactions]
    fb_docs = fb_coll.find({'message_id': {'$in': ids}})
    fb_map = {doc['message_id']: doc for doc in fb_docs}
    for item in interactions:
        doc = fb_map.get(item['id'], {})
        # override defaults if present
        item['rating'] = doc.get('feedback', item.get('rating'))
        item['comments'] = doc.get('comments', item.get('comments'))
    print(f"Returning {len(interactions)} interactions with persisted feedback")
    return jsonify(interactions)

@app.route('/api/comments', methods=['POST'])
def add_comment():
    data = request.get_json()
    # Standardize on message_id
    message_id = data.get('message_id')
    # For backward compatibility, still accept messageId or interactionId
    if not message_id:
        message_id = data.get('messageId') or data.get('interactionId')
    comment = data.get('comment')
    rating = data.get('rating')
    # Determine which fields were sent
    has_comment = 'comment' in data
    has_rating = 'rating' in data
    # Basic validation
    if not message_id:
        return jsonify({'error': 'message_id required'}), 400
    if has_rating and rating not in ('good','bad','neutral', None):
        return jsonify({'error': 'Invalid rating value'}), 400
    if has_comment and comment is not None and not isinstance(comment, str):
        return jsonify({'error': 'Comment must be a string'}), 400

    # Use shared DB client
    collection = db['alfred_feedback']

    try:
        # Build update operations
        ops = {}
        if has_comment and comment:
            ops.setdefault('$push', {})['comments'] = comment
        if has_rating:
            # Save rating even if null to allow clearing
            ops.setdefault('$set', {})['feedback'] = rating
        # Ensure document exists: set message_id on insert
        ops.setdefault('$setOnInsert', {})['message_id'] = message_id
        collection.update_one({'message_id': message_id}, ops, upsert=True)

        return jsonify({'success': True}), 200
    except Exception as e:
        print(f"Error saving comment: {e}")
        return jsonify({'error': str(e)}), 500

# Enable CORS
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE')
    return response

if __name__ == '__main__':
    # Use a different port than the React app
    app.run(debug=True, port=3002)
