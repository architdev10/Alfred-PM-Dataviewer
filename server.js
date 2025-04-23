import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// ES Module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Create chat_exports directory if it doesn't exist
const exportDir = path.join(__dirname, 'chat_exports');
if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir, { recursive: true });
}

// Endpoint to fetch interactions data
app.get('/api/interactions', (req, res) => {
  // Run the Python script to fetch data
  const pythonProcess = spawn('python', [
    '-c',
    `
import json
import sys
sys.path.append('${__dirname}')
from db import connect_to_mongodb, extract_chat_histories

collection = connect_to_mongodb()
if collection:
    chat_data = extract_chat_histories(collection)
    # Format data for frontend
    interactions = []
    for user_id, sessions in chat_data.items():
        for session_id, messages in sessions.items():
            for i, message in enumerate(messages):
                if message.get('role') == 'user' and i+1 < len(messages) and messages[i+1].get('role') == 'assistant':
                    interactions.append({
                        'id': f"{user_id}_{session_id}_{i}",
                        'userPrompt': message.get('content', ''),
                        'aiResponse': messages[i+1].get('content', ''),
                        'timestamp': message.get('timestamp', 'Unknown time'),
                        'agents': message.get('agents', []),
                        'rating': None,
                        'comments': [],
                        'user': {
                            'name': user_id,
                            'avatar': ''
                        }
                    })
    print(json.dumps(interactions))
else:
    print(json.dumps([]))
    `
  ]);

  let dataString = '';
  
  pythonProcess.stdout.on('data', (data) => {
    dataString += data.toString();
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`Python Error: ${data}`);
  });

  pythonProcess.on('close', (code) => {
    if (code !== 0) {
      return res.status(500).json({ error: 'Failed to fetch data from MongoDB' });
    }
    
    try {
      const interactions = JSON.parse(dataString);
      return res.json(interactions);
    } catch (error) {
      console.error('Error parsing JSON:', error);
      return res.status(500).json({ error: 'Failed to parse data' });
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Press Ctrl+C to stop the server');
});
