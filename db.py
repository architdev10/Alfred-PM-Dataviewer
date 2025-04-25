"""
MongoDB Database Connection and Operations Module

This module provides functions to connect to a MongoDB database
and perform various data extraction operations.
"""

import pymongo
from pymongo import MongoClient
import pandas as pd
import json
from datetime import datetime
import os
from urllib.parse import quote_plus

# Database connection constants
USER_NAME = "alfred"
PASS = "alfred-coco-cola"
MONGO_CLIENT = 'alfred-coco-cola'
MONGO_COLLECTION = 'email_threads'
MONGO_HOST = '172.178.91.142'
MONGO_PORT = 27017


def connect_to_mongodb(collection_name=None):
    """
    Establish connection to MongoDB
    
    Args:
        collection_name (str, optional): Name of the collection to connect to.
            Defaults to the value in MONGO_COLLECTION.
            
    Returns:
        tuple: (client, collection) if successful, (None, None) otherwise
    """
    try:
        username = quote_plus(USER_NAME)
        password = quote_plus(PASS)
        
        uri = f"mongodb://{username}:{password}@{MONGO_HOST}:{MONGO_PORT}/{MONGO_CLIENT}?authSource={MONGO_CLIENT}"
        
        client = MongoClient(uri)
        # Test connection
        client.admin.command('ping')
        
        db = client[MONGO_CLIENT]
        collection = db[collection_name if collection_name else MONGO_COLLECTION]
        
        print(f"Successfully connected to MongoDB: {MONGO_CLIENT}")
        return client, collection
    except Exception as e:
        print(f"Error connecting to MongoDB: {e}")
        return None, None


def extract_chat_histories(collection):
    """
    Extract all chat histories for all users in a hierarchical JSON format
    
    Args:
        collection (pymongo.collection.Collection): MongoDB collection to query
        
    Returns:
        dict: Nested dictionary with user_id -> session_id -> chat_history structure
    """
    if collection is None:
        print("Cannot extract chat histories: collection is None")
        return {}
        
    all_chats = {}
    
    try:
        # Find all users
        users = collection.find({})
        user_count = 0
        session_count = 0
        
        for user in users:
            user_id = str(user.get('userid', user.get('_id', 'unknown')))
            
            # Initialize user entry if not already present
            if user_id not in all_chats:
                all_chats[user_id] = {}
            
            # Process each session for this user
            sessions = user.get('sessions', [])
            for session in sessions:
                session_id = str(session.get('session_id', 'unknown'))
                chat_history = session.get('chat_history', [])
                # Annotate each message with explicit sequence number and ensure timestamp exists
                for idx, msg in enumerate(chat_history):
                    if isinstance(msg, dict):
                        # Fallback timestamp if missing or empty
                        if not msg.get('timestamp'):
                            msg['timestamp'] = datetime.utcnow().isoformat()
                        # Explicit sequence index
                        msg['sequence'] = idx
                        msg['message_id'] = f"{user_id}_{session_id}_{idx}"
                projects = session.get('projects', [])
                tasks = session.get('tasks', [])
                email_thread_chain = session.get('email_thread_chain', [])
                email_thread_id = session.get('email_thread_id', None)

                # Store the session data as a dict with all fields
                all_chats[user_id][session_id] = {
                    'chat_history': chat_history,
                    'projects': projects,
                    'tasks': tasks,
                    'email_thread_chain': email_thread_chain,
                    'email_thread_id': email_thread_id
                }
                
                session_count += 1
            user_count += 1
        
        print(f"Processed {user_count} users with {session_count} sessions")
    except Exception as e:
        print(f"Error extracting chat histories: {e}")
    
    return all_chats


def save_to_json(data, filename=None, output_dir="chat_exports"):
    """
    Save data to a JSON file
    
    Args:
        data (dict): Data to save
        filename (str, optional): Name of the file. If not provided, a timestamp will be used.
        output_dir (str, optional): Directory to save the file. Defaults to "chat_exports".
        
    Returns:
        str: Path to the saved file
    """
    os.makedirs(output_dir, exist_ok=True)
    
    if not filename:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"chat_histories_{timestamp}.json"
    
    filepath = os.path.join(output_dir, filename)
    
    with open(filepath, 'w') as f:
        json.dump(data, f)
    
    print(f"Data saved to {filepath}")
    return filepath


def save_to_csv(data, filename=None, output_dir="chat_exports"):
    """
    Save data to a CSV file
    
    Args:
        data (dict): Data to save
        filename (str, optional): Name of the file. If not provided, a timestamp will be used.
        output_dir (str, optional): Directory to save the file. Defaults to "chat_exports".
        
    Returns:
        str: Path to the saved file
    """
    os.makedirs(output_dir, exist_ok=True)
    
    if not filename:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"chat_histories_{timestamp}.csv"
    
    filepath = os.path.join(output_dir, filename)
    
    # Convert the nested dictionary to a format suitable for CSV
    flattened_data = []
    for user_id, sessions in data.items():
        for session_id, chat_history in sessions.items():
            for message in chat_history['chat_history']:
                entry = {
                    'user_id': user_id,
                    'session_id': session_id,
                    'timestamp': message.get('timestamp', ''),
                    'role': message.get('role', ''),
                    'content': message.get('content', ''),
                    'sequence': message.get('sequence', ''),
                    'message_id': message.get('message_id', '')
                }
                flattened_data.append(entry)
    
    df = pd.DataFrame(flattened_data)
    df.to_csv(filepath, index=False)
    
    print(f"Data saved to {filepath}")
    return filepath


def query_collection(collection, query=None, projection=None, limit=0):
    """
    Query a MongoDB collection with optional filtering and projection
    
    Args:
        collection (pymongo.collection.Collection): MongoDB collection to query
        query (dict, optional): MongoDB query filter. Defaults to None (all documents).
        projection (dict, optional): Fields to include/exclude. Defaults to None (all fields).
        limit (int, optional): Maximum number of results. Defaults to 0 (no limit).
        
    Returns:
        list: List of documents matching the query
    """
    try:
        cursor = collection.find(query or {}, projection or {})
        if limit > 0:
            cursor = cursor.limit(limit)
        
        return list(cursor)
    except Exception as e:
        print(f"Error querying collection: {e}")
        return []


def get_collection_stats(collection):
    """
    Get basic statistics about a collection
    
    Args:
        collection (pymongo.collection.Collection): MongoDB collection
        
    Returns:
        dict: Collection statistics
    """
    try:
        count = collection.count_documents({})
        sample = list(collection.find().limit(1))
        fields = list(sample[0].keys()) if sample else []
        
        return {
            'collection_name': collection.name,
            'document_count': count,
            'sample_fields': fields
        }
    except Exception as e:
        print(f"Error getting collection stats: {e}")
        return {
            'collection_name': collection.name if collection else 'Unknown',
            'error': str(e)
        }


# Example usage
if __name__ == "__main__":
    client, collection = connect_to_mongodb()
    if collection:
        stats = get_collection_stats(collection)
        print(f"Collection stats: {stats}")
        
        # Example: Extract and save chat histories
        chat_data = extract_chat_histories(collection)
        if chat_data:
            save_to_json(chat_data, "all_chat_histories.json")
            save_to_csv(chat_data, "all_chat_histories.csv")
        else:
            print("No chat data was extracted")
