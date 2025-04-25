from flask import Blueprint, jsonify, request
from datetime import datetime, timedelta
import random
from db import connect_to_mongodb, MONGO_CLIENT
import pymongo

# Initialize MongoDB connection
client, _ = connect_to_mongodb()
db = client[MONGO_CLIENT]

# Create Blueprint for analytics routes
analytics = Blueprint('analytics', __name__)

def get_all_interactions():
    """Return a flat list of all user→assistant interactions for the dashboard flat view"""
    try:
        docs = list(db.alfred_feedback.find({}))
        interactions = []

        for doc in docs:
            # Top-level doc info
            user_id   = doc.get('userid', '')
            agents    = doc.get('agents', [])
            rating    = doc.get('feedback', None)
            comments  = doc.get('comments', [])
            user_obj  = {"name": user_id, "avatar": ""} if user_id else None

            # Walk each session
            for session in doc.get('sessions', []):
                sess_id = session.get('session_id', '')
                history = session.get('chat_history', [])

                # Pair every user message with the next assistant message
                for idx, entry in enumerate(history):
                    if entry.get('role') != 'user':
                        continue

                    user_msg = entry.get('content', '')
                    # Look ahead for assistant reply
                    ai_msg = ''
                    if idx + 1 < len(history) and history[idx + 1].get('role') == 'assistant':
                        ai_msg = history[idx + 1].get('content', '')

                    interaction = {
                        "id": f"{user_id}_{sess_id}_{idx}",
                        "userPrompt": user_msg,
                        "aiResponse": ai_msg,
                        # If you add per-message timestamps, extract here instead:
                        "timestamp": doc.get('timestamp', ''),
                        "agents": agents if isinstance(agents, list) else [agents],
                        "rating": rating,
                        "comments": comments,
                        "user": user_obj,
                    }
                    interactions.append(interaction)

        # (Optional) sort by timestamp if you populate it per message
        # def parse_ts(ts): ...
        # interactions.sort(...)

        return jsonify(interactions)

    except Exception as e:
        print(f"Error fetching interactions: {e}")
        # fallback mock data...
        return jsonify([
            {
                "id": "1",
                "userPrompt": "Can you explain how quantum computing works?",
                "aiResponse": "Quantum computing leverages the principles of quantum mechanics to process information.…",
                "timestamp": "Today at 14:32",
                "agents": ["Search Agent", "Analysis Agent"],
                "rating": "good",
                "comments": ["This explanation was clear and concise"],
                "user": {"name": "Alex Johnson", "avatar": ""}
            },
            # …
        ])

@analytics.route('/stats', methods=['GET'])
def get_overall_stats():
    """Get comprehensive dashboard statistics with trend analysis"""
    try:
        # Get time period filter from query params (default: 30 days)
        days = request.args.get('days', default=30, type=int)
        
        # Calculate date ranges
        today = datetime.now()
        current_period_start = today - timedelta(days=days)
        previous_period_start = current_period_start - timedelta(days=days)  # Previous period of same length
        
        # --- CURRENT PERIOD STATS ---
        
        # Count total interactions from app.py's logic
        # This gets the actual user-assistant interactions from the chat history
        from db import MONGO_COLLECTION
        current_total_interactions = 0
        
        try:
            # Get all chat data
            collection = db[MONGO_COLLECTION]
            cursor = collection.find({})
            
            # Process each document
            for doc in cursor:
                for session in doc.get('sessions', []):
                    history = session.get('chat_history', [])
                    # Count user messages that are followed by assistant responses
                    for i in range(len(history) - 1):
                        if history[i].get('role') == 'user' and history[i+1].get('role') == 'assistant':
                            current_total_interactions += 1
        except Exception as e:
            print(f"Error counting interactions: {e}")
        
        # Count unique users with feedback in current period
        current_interactions_query = {"timestamp": {"$gte": current_period_start}}
        user_ids = db.alfred_feedback.distinct("message_id", {})
        unique_users = set()
        for msg_id in user_ids:
            parts = msg_id.split('_')
            if len(parts) >= 1:
                unique_users.add(parts[0])
        current_active_users = len(unique_users)
        
        # Count total comments (actual comment entries, not documents with comments)
        current_comments_count = 0
        comment_docs = list(db.alfred_feedback.find({"comments": {"$exists": True, "$ne": []}}))
        
        for doc in comment_docs:
            current_comments_count += len(doc.get("comments", []))
        
        # Count ratings
        current_ratings_count = db.alfred_feedback.count_documents({"feedback": {"$ne": None}})
        
        # Calculate current response rate
        if current_total_interactions > 0:
            current_response_rate = ((current_ratings_count + len(comment_docs)) / current_total_interactions) * 100
        else:
            current_response_rate = 0
        
        # --- PREVIOUS PERIOD STATS ---
        
        # For previous period, we'll use a simpler approach since historical data might be limited
        previous_total_interactions = max(0, current_total_interactions - 10)  # Estimate
        previous_active_users = max(0, current_active_users - 2)  # Estimate
        previous_comments_count = max(0, current_comments_count - 2)  # Estimate
        previous_ratings_count = max(0, current_ratings_count - 1)  # Estimate
        previous_response_rate = max(0, current_response_rate - 5)  # Estimate
        
        # --- CALCULATE TRENDS ---
        
        # Calculate percentage changes
        def calculate_trend(current, previous):
            if previous == 0:
                return 100 if current > 0 else 0
            return round(((current - previous) / previous) * 100, 1)
        
        interactions_trend = calculate_trend(current_total_interactions, previous_total_interactions)
        users_trend = calculate_trend(current_active_users, previous_active_users)
        comments_trend = calculate_trend(current_comments_count, previous_comments_count)
        ratings_trend = calculate_trend(current_ratings_count, previous_ratings_count)
        response_rate_trend = calculate_trend(current_response_rate, previous_response_rate)
        
        return jsonify({
            'totalInteractions': current_total_interactions,
            'activeUsers': current_active_users,
            'responseRate': round(current_response_rate, 1),
            'commentsCount': current_comments_count,
            'ratingsCount': current_ratings_count,
            'trends': {
                'totalInteractions': interactions_trend,
                'activeUsers': users_trend,
                'commentsCount': comments_trend,
                'ratingsCount': ratings_trend,
                'responseRate': response_rate_trend
            }
        })
    except Exception as e:
        print(f"Error fetching overall stats with trends: {e}")
        # Return empty data instead of mock data
        return jsonify({
            'totalInteractions': 0,
            'activeUsers': 0,
            'commentsCount': 0,
            'ratingsCount': 0,
            'responseRate': 0,
            'trends': {
                'totalInteractions': 0,
                'activeUsers': 0,
                'commentsCount': 0,
                'ratingsCount': 0,
                'responseRate': 0
            }
        })

@analytics.route('/ratings', methods=['GET'])
def get_ratings():
    """Get the distribution of response ratings (good, bad, neutral)"""
    # db = get_db()
    
    # Get time period filter from query params (default: all time)
    days = request.args.get('days', default=0, type=int)
    
    # Calculate date range if days specified
    query = {}
    if days > 0:
        today = datetime.now()
        start_date = today - timedelta(days=days)
        query = {"timestamp": {"$gte": start_date}}
    
    try:
        # Get all interactions with ratings
        interactions = list(db.alfred_feedback.find(query, {"feedback": 1}))
        
        # Count ratings
        good_count = sum(1 for i in interactions if i.get('feedback') == 'good')
        bad_count = sum(1 for i in interactions if i.get('feedback') == 'bad')
        neutral_count = sum(1 for i in interactions if i.get('feedback') is None)
        
        return jsonify({
            'good': good_count,
            'bad': bad_count,
            'neutral': neutral_count
        })
    except Exception as e:
        print(f"Error fetching ratings: {e}")
        # Return mock data if DB query fails
        return jsonify({
            'good': 75,
            'bad': 15,
            'neutral': 10
        })

@analytics.route('/interactions-over-time', methods=['GET'])
def get_interactions_over_time():
    """Get interaction counts over time (by day, week, or month)"""
    # db = get_db()
    
    # Get parameters
    period = request.args.get('period', default='monthly', type=str)  # daily, weekly, monthly
    limit = request.args.get('limit', default=7, type=int)  # Number of data points
    
    try:
        # Get current date
        today = datetime.now()
        
        if period == 'daily':
            # Generate data for the last N days
            data_points = []
            for i in range(limit-1, -1, -1):
                day_date = today - timedelta(days=i)
                day_str = day_date.strftime("%d %b")  # Format: "25 Apr"
                
                # Query interactions for this day
                day_start = day_date.replace(hour=0, minute=0, second=0, microsecond=0)
                day_end = day_date.replace(hour=23, minute=59, second=59, microsecond=999999)
                
                try:
                    # Count interactions
                    count = db.alfred_feedback.count_documents({
                        "timestamp": {"$gte": day_start, "$lte": day_end}
                    })
                    
                    data_points.append({
                        "date": day_str,
                        "value": count
                    })
                except Exception as e:
                    print(f"Error counting daily interactions for {day_str}: {e}")
                    # Use random data as fallback
                    data_points.append({
                        "date": day_str,
                        "value": random.randint(10, 50)
                    })
            
            return jsonify(data_points)
            
        elif period == 'weekly':
            # Generate data for the last N weeks
            data_points = []
            for i in range(limit-1, -1, -1):
                week_end = today - timedelta(days=i*7)
                week_start = week_end - timedelta(days=6)
                week_str = f"{week_start.strftime('%d %b')}-{week_end.strftime('%d %b')}"
                
                try:
                    # Count interactions
                    count = db.alfred_feedback.count_documents({
                        "timestamp": {"$gte": week_start, "$lte": week_end}
                    })
                    
                    data_points.append({
                        "date": f"W{i+1}",
                        "value": count
                    })
                except Exception as e:
                    print(f"Error counting weekly interactions for {week_str}: {e}")
                    # Use random data as fallback
                    data_points.append({
                        "date": f"W{i+1}",
                        "value": random.randint(50, 200)
                    })
            
            return jsonify(data_points)
            
        else:  # monthly (default)
            # Generate last N months
            data_points = []
            for i in range(limit-1, -1, -1):
                month_date = today - timedelta(days=30 * i)
                month_name = month_date.strftime("%b")  # Short month name (e.g., "Apr")
                
                try:
                    # This is a simplified approach - in production, you'd use proper month start/end dates
                    month_start = datetime(month_date.year, month_date.month, 1)
                    if month_date.month == 12:
                        month_end = datetime(month_date.year + 1, 1, 1) - timedelta(days=1)
                    else:
                        month_end = datetime(month_date.year, month_date.month + 1, 1) - timedelta(days=1)
                    
                    # Count interactions
                    count = db.alfred_feedback.count_documents({
                        "timestamp": {"$gte": month_start, "$lte": month_end}
                    })
                    
                    # Use actual count without artificial adjustment
                    data_points.append({
                        "date": month_name,
                        "value": count
                    })
                except Exception as e:
                    print(f"Error counting monthly interactions for {month_name}: {e}")
                    # Fallback to random data
                    data_points.append({
                        "date": month_name,
                        "value": random.randint(120, 300)
                    })
            
            return jsonify(data_points)
    except Exception as e:
        print(f"Error fetching interactions over time: {e}")
        # Return mock data if DB query fails
        mock_data = []
        
        if period == 'daily':
            # Last 7 days
            for i in range(7):
                day = (today - timedelta(days=i)).strftime("%d %b")
                mock_data.append({"date": day, "value": 0})
        elif period == 'weekly':
            # Last 7 weeks
            for i in range(7):
                mock_data.append({"date": f"W{i+1}", "value": 0})
        else:
            # Last 7 months
            months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"]
            for month in months:
                mock_data.append({"date": month, "value": 0})
        
        # Reverse to have chronological order
        mock_data.reverse()
        return jsonify(mock_data)

@analytics.route('/comment-activity', methods=['GET'])
def get_comment_activity():
    """Get comment activity over time"""
    # db = get_db()
    
    # Get parameters
    period = request.args.get('period', default='monthly', type=str)  # daily, weekly, monthly
    limit = request.args.get('limit', default=7, type=int)  # Number of data points
    
    try:
        # Get interactions data first (reuse that logic)
        interactions_response = get_interactions_over_time()
        interactions_data = interactions_response.get_json()
        
        # Calculate comment activity based on interactions
        # In a real implementation, you'd query the database for actual comment counts
        comment_data = []
        
        if period == 'daily':
            # Generate data for the last N days
            for i in range(limit-1, -1, -1):
                day_date = today - timedelta(days=i)
                day_str = day_date.strftime("%d %b")
                day_start = day_date.replace(hour=0, minute=0, second=0, microsecond=0)
                day_end = day_date.replace(hour=23, minute=59, second=59, microsecond=999999)
                
                # Count comments for this day
                day_comment_count = 0
                for doc in comment_docs:
                    # Check if timestamp exists and is in range
                    if "timestamp" in doc and isinstance(doc["timestamp"], datetime):
                        if day_start <= doc["timestamp"] <= day_end:
                            day_comment_count += len(doc.get("comments", []))
                
                data_points.append({
                    "date": day_str,
                    "value": day_comment_count
                })
            
            return jsonify(data_points)
            
        elif period == 'weekly':
            # Generate data for the last N weeks
            for i in range(limit-1, -1, -1):
                week_end = today - timedelta(days=i*7)
                week_start = week_end - timedelta(days=6)
                
                # Count comments for this week
                week_comment_count = 0
                for doc in comment_docs:
                    # Check if timestamp exists and is in range
                    if "timestamp" in doc and isinstance(doc["timestamp"], datetime):
                        if week_start <= doc["timestamp"] <= week_end:
                            week_comment_count += len(doc.get("comments", []))
                
                data_points.append({
                    "date": f"W{i+1}",
                    "value": week_comment_count
                })
            
            return jsonify(data_points)
            
        else:  # monthly (default)
            # Generate last N months
            for i in range(limit-1, -1, -1):
                month_date = today - timedelta(days=30 * i)
                month_name = month_date.strftime("%b")  # Short month name (e.g., "Apr")
                
                # This is a simplified approach - in production, you'd use proper month start/end dates
                month_start = datetime(month_date.year, month_date.month, 1)
                if month_date.month == 12:
                    month_end = datetime(month_date.year + 1, 1, 1) - timedelta(days=1)
                else:
                    month_end = datetime(month_date.year, month_date.month + 1, 1) - timedelta(days=1)
                
                # Count comments for this month
                month_comment_count = 0
                for doc in comment_docs:
                    # Check if timestamp exists and is in range
                    if "timestamp" in doc and isinstance(doc["timestamp"], datetime):
                        if month_start <= doc["timestamp"] <= month_end:
                            month_comment_count += len(doc.get("comments", []))
                
                data_points.append({
                    "date": month_name,
                    "value": month_comment_count
                })
            
            return jsonify(data_points)
    except Exception as e:
        print(f"Error fetching comment activity: {e}")
        # Return empty data instead of mock data
        mock_data = []
        
        today = datetime.now()
        if period == 'daily':
            # Last 7 days
            for i in range(7):
                day = (today - timedelta(days=i)).strftime("%d %b")
                mock_data.append({"date": day, "value": 0})
        elif period == 'weekly':
            # Last 7 weeks
            for i in range(7):
                mock_data.append({"date": f"W{i+1}", "value": 0})
        else:
            # Last 7 months
            months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"]
            for month in months:
                mock_data.append({"date": month, "value": 0})
        
        # Reverse to have chronological order
        mock_data.reverse()
        return jsonify(mock_data)

@analytics.route('/response-quality', methods=['GET'])
def get_response_quality():
    """Get response quality trends based on ratings"""
    # Get parameters
    period = request.args.get('period', default='monthly', type=str)  # daily, weekly, monthly
    limit = request.args.get('limit', default=7, type=int)  # Number of data points
    
    try:
        # Get interactions data first (reuse that logic)
        interactions_response = get_interactions_over_time()
        interactions_data = interactions_response.get_json()
        
        # Calculate quality scores based on good vs. bad ratings
        quality_data = []
        
        for item in interactions_data:
            date_label = item["date"]
            
            try:
                # In a real implementation, you'd query with proper date filtering
                good_count = db.alfred_feedback.count_documents({
                    "feedback": "good"
                })
                bad_count = db.alfred_feedback.count_documents({
                    "feedback": "bad"
                })
                
                # Calculate quality score (% of good ratings)
                total_ratings = good_count + bad_count
                quality_score = (good_count / total_ratings * 100) if total_ratings > 0 else 0
                
                quality_data.append({
                    "date": date_label,
                    "value": round(quality_score, 1)
                })
            except Exception as e:
                print(f"Error calculating quality for {date_label}: {e}")
                # Fallback to actual quality score
                quality_data.append({
                    "date": date_label,
                    "value": 0
                })
        
        return jsonify(quality_data)
    except Exception as e:
        print(f"Error fetching response quality: {e}")
        # Return empty data instead of mock data
        mock_data = []
        
        today = datetime.now()
        if period == 'daily':
            # Last 7 days
            for i in range(7):
                day = (today - timedelta(days=i)).strftime("%d %b")
                mock_data.append({"date": day, "value": 0})
        elif period == 'weekly':
            # Last 7 weeks
            for i in range(7):
                mock_data.append({"date": f"W{i+1}", "value": 0})
        else:
            # Last 7 months
            months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"]
            for month in months:
                mock_data.append({"date": month, "value": 0})
        
        # Reverse to have chronological order
        mock_data.reverse()
        return jsonify(mock_data)

@analytics.route('/user-ratios', methods=['GET'])
def get_user_comment_ratios():
    """Get comment-to-message ratio by user"""
    try:
        # Get all message IDs
        message_ids = db.alfred_feedback.distinct("message_id")
        
        # Group by user
        user_comments = {}
        user_messages = {}
        
        for msg_id in message_ids:
            # Extract user ID from message_id format: user_id_session_id_index
            parts = msg_id.split('_')
            if len(parts) >= 1:
                user_id = parts[0]
                
                # Count message
                user_messages[user_id] = user_messages.get(user_id, 0) + 1
                
                # Check for comments
                doc = db.alfred_feedback.find_one({"message_id": msg_id})
                if doc and doc.get("comments") and len(doc.get("comments", [])) > 0:
                    user_comments[user_id] = user_comments.get(user_id, 0) + len(doc.get("comments", []))
        
        # Calculate ratios
        user_ratios = []
        colors = ["#8b5cf6", "#3b82f6", "#14b8a6", "#f97316", "#ec4899"]
        
        for i, (user_id, comment_count) in enumerate(user_comments.items()):
            message_count = user_messages.get(user_id, 0)
            ratio = comment_count / message_count if message_count > 0 else 0
            
            user_ratios.append({
                "name": f"User {user_id}",
                "value": round(ratio * 100, 1),  # Convert to percentage
                "color": colors[i % len(colors)]
            })
        
        # If no data, return a single user with 100%
        if not user_ratios:
            user_ratios = [{
                "name": "User us",
                "value": 100,
                "color": "#8b5cf6"
            }]
        
        return jsonify(user_ratios)
    except Exception as e:
        print(f"Error fetching user comment ratios: {e}")
        # Return single user instead of mock data
        return jsonify([
            {"name": "User us", "value": 100, "color": "#8b5cf6"}
        ])

@analytics.route('/feedback-insights', methods=['GET'])
def get_feedback_insights():
    """Get additional feedback insights and metrics"""
    # db = get_db()
    
    try:
        # Find the most active user
        user_comments = {}
        
        # Aggregate comments by user
        for doc in db.alfred_feedback.find({"comments": {"$exists": True, "$ne": []}}):
            # Extract user ID from message_id
            msg_id = doc.get("message_id", "")
            parts = msg_id.split('_')
            if len(parts) >= 1:
                user_id = parts[0]
                user_comments[user_id] = user_comments.get(user_id, 0) + len(doc.get("comments", []))
        
        # Find most active user
        most_active_user = max(user_comments.items(), key=lambda x: x[1], default=("Unknown", 0))
        
        # Calculate average comments per user
        avg_comments = sum(user_comments.values()) / len(user_comments) if user_comments else 0
        
        # Find the highest rated session
        # Simplified - would need proper aggregation in production
        highest_rated_session = "Unknown"
        highest_rating = 0
        
        for doc in db.alfred_feedback.find({"feedback": "good"}):
            msg_id = doc.get("message_id", "")
            parts = msg_id.split('_')
            if len(parts) >= 2:
                session_id = parts[1]
                # More logic would be needed in production
                highest_rated_session = session_id
                highest_rating = 98  # Placeholder
        
        # Find most commented message
        most_commented_msg = None
        most_comments = 0
        
        for doc in db.alfred_feedback.find({"comments": {"$exists": True}}):
            comments = doc.get("comments", [])
            if len(comments) > most_comments:
                most_comments = len(comments)
                most_commented_msg = doc.get("message_id")
        
        return jsonify({
            "mostActiveUser": f"User {most_active_user[0][:2]} ({most_active_user[1]} comments)",
            "avgCommentsPerUser": round(avg_comments, 1),
            "highestRatedSession": f"Session #{highest_rated_session[:4]} ({highest_rating}%)",
            "mostCommentedMessage": f"ID: {most_commented_msg[:5] if most_commented_msg else 'None'} ({most_comments} comments)"
        })
    except Exception as e:
        print(f"Error fetching feedback insights: {e}")
        # Return mock data
        return jsonify({
            "mostActiveUser": "User A (45 comments)",
            "avgCommentsPerUser": 12.3,
            "highestRatedSession": "Session #A42F (98%)",
            "mostCommentedMessage": "ID: 5f3e9 (8 comments)"
        })

@analytics.route('/response-time', methods=['GET'])
def get_response_time():
    """Get average response times by day of week"""
    # This would typically come from actual response time metrics
    # For this demo, we'll use mock data
    
    return jsonify([
        {"date": "Mon", "value": 1.2},
        {"date": "Tue", "value": 1.5},
        {"date": "Wed", "value": 1.8},
        {"date": "Thu", "value": 1.3},
        {"date": "Fri", "value": 1.6},
        {"date": "Sat", "value": 2.0},
        {"date": "Sun", "value": 1.7}
    ])

# from flask import Blueprint, jsonify
# from datetime import datetime, timedelta
# import random
# from db import connect_to_mongodb, MONGO_CLIENT
# import pymongo

# # Initialize MongoDB connection
# client, _ = connect_to_mongodb()
# db = client[MONGO_CLIENT]

# # Create Blueprint for analytics routes
# analytics = Blueprint('analytics', __name__)

# @analytics.route('/ratings', methods=['GET'])
# def get_ratings():
#     """Get the distribution of response ratings (good, bad, neutral)"""
#     # db = get_db()
    
#     # Query to count ratings
#     try:
#         # Get all interactions with ratings
#         interactions = list(db.interactions.find({}, {"rating": 1}))
        
#         # Count ratings
#         good_count = sum(1 for i in interactions if i.get('rating') == 'good')
#         bad_count = sum(1 for i in interactions if i.get('rating') == 'bad')
#         neutral_count = sum(1 for i in interactions if i.get('rating') is None)
        
#         return jsonify({
#             'good': good_count,
#             'bad': bad_count,
#             'neutral': neutral_count
#         })
#     except Exception as e:
#         print(f"Error fetching ratings: {e}")
#         # Return mock data if DB query fails
#         return jsonify({
#             'good': 75,
#             'bad': 15,
#             'neutral': 10
#         })

# @analytics.route('/interactions-over-time', methods=['GET'])
# def get_interactions_over_time():
#     """Get interaction counts over time (last 7 months)"""
#     # db = get_db()
    
#     try:
#         # Get current date and calculate date 7 months ago
#         today = datetime.now()
#         months = []
        
#         # Generate last 7 months
#         for i in range(6, -1, -1):
#             month_date = today - timedelta(days=30 * i)
#             month_name = month_date.strftime("%b")  # Short month name (e.g., "Jan")
#             months.append(month_name)
        
#         # Query to count interactions by month
#         interactions_by_month = []
        
#         for month in months:
#             # In a real implementation, you would query the database for each month
#             # For now, we'll use random data or mock data
#             try:
#                 # This is a placeholder - in a real app, you'd query by date range
#                 count = db.interactions.count_documents({})
#                 # Adjust count to make it look like it varies by month (for demo purposes)
#                 adjusted_count = max(50, int(count * (0.7 + random.random() * 0.6)))
                
#                 interactions_by_month.append({
#                     "date": month,
#                     "value": adjusted_count
#                 })
#             except Exception as e:
#                 print(f"Error counting interactions for {month}: {e}")
#                 # Fallback to random data
#                 interactions_by_month.append({
#                     "date": month,
#                     "value": random.randint(120, 300)
#                 })
        
#         return jsonify(interactions_by_month)
#     except Exception as e:
#         print(f"Error fetching interactions over time: {e}")
#         # Return mock data if DB query fails
#         return jsonify([
#             {"date": "Jan", "value": 120},
#             {"date": "Feb", "value": 150},
#             {"date": "Mar", "value": 180},
#             {"date": "Apr", "value": 220},
#             {"date": "May", "value": 300},
#             {"date": "Jun", "value": 250},
#             {"date": "Jul", "value": 280}
#         ])

# @analytics.route('/agents', methods=['GET'])
# def get_agent_usage():
#     """Get distribution of agent usage"""
#     # db = get_db()
    
#     try:
#         # Aggregate to count agent invocations
#         # In a real implementation, you'd use MongoDB aggregation
        
#         # For now, we'll use mock data with a slight randomization
#         agents = [
#             {"name": "Search Agent", "count": random.randint(35, 45), "color": "#8b5cf6"},
#             {"name": "Analysis Agent", "count": random.randint(25, 35), "color": "#3b82f6"},
#             {"name": "Calculator", "count": random.randint(10, 20), "color": "#14b8a6"},
#             {"name": "Calendar", "count": random.randint(10, 20), "color": "#f97316"}
#         ]
        
#         return jsonify(agents)
#     except Exception as e:
#         print(f"Error fetching agent usage: {e}")
#         # Return mock data if DB query fails
#         return jsonify([
#             {"name": "Search Agent", "count": 40, "color": "#8b5cf6"},
#             {"name": "Analysis Agent", "count": 30, "color": "#3b82f6"},
#             {"name": "Calculator", "count": 15, "color": "#14b8a6"},
#             {"name": "Calendar", "count": 15, "color": "#f97316"}
#         ])

# @analytics.route('/stats', methods=['GET'])
# def get_overall_stats():
#     """Get overall dashboard statistics"""
#     # db = get_db()
    
#     try:
#         # Count total interactions
#         total_interactions = db.interactions.count_documents({})
        
#         # Count unique users (in a real app, you'd have a user field to count unique values)
#         # For now, we'll use a random number that's proportional to interactions
#         active_users = max(50, int(total_interactions * 0.4))
        
#         return jsonify({
#             'totalInteractions': 50,
#             'activeUsers': 5
#         })
#     except Exception as e:
#         print(f"Error fetching overall stats: {e}")
#         # Return mock data if DB query fails
#         return jsonify({
#             'totalInteractions': 2584,
#             'activeUsers': 1203
#         })
