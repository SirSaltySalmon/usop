# Character Voting Website - Integration Strategy

## 🎯 Project Overview
A web service where users vote yes/no on random characters, then see results and character info before moving to the next character.

## 🏗️ Recommended Tech Stack (Beginner-Friendly)

### Frontend
- **HTML/CSS/JavaScript** (vanilla) or **React** if you want to learn a framework
- **Chart.js** or **Recharts** for vote visualization
- **Responsive design** with CSS Grid/Flexbox

### Backend Options
**Option 1 - Simple Start:**
- **Node.js + Express.js** (JavaScript everywhere)
- **SQLite** database (file-based, no server setup)

**Option 2 - Cloud-Ready:**
- **Node.js + Express.js** 
- **PostgreSQL** or **MongoDB Atlas** (free tier)
- **Vercel/Netlify** for hosting

### Database Schema

```sql
-- Characters table with tags
CREATE TABLE characters (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    franchise VARCHAR(100) NOT NULL,
    image_url VARCHAR(255) NOT NULL,
    tags TEXT, -- comma-separated tags: "anime,protagonist,hero"
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User interactions (votes or skips) - no session table needed
CREATE TABLE user_interactions (
    id INTEGER PRIMARY KEY,
    character_id INTEGER,
    session_id VARCHAR(100),
    action_type VARCHAR(10), -- 'vote' or 'skip'
    vote_type BOOLEAN, -- true for yes, false for no, NULL for skip
    was_majority BOOLEAN, -- NULL for skips
    majority_percentage DECIMAL(5,2), -- for point calculations
    points_earned INTEGER DEFAULT 0,
    interacted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters(id)
);

-- Optional: Separate tags table for better normalization
CREATE TABLE character_tags (
    id INTEGER PRIMARY KEY,
    character_id INTEGER,
    tag VARCHAR(50),
    FOREIGN KEY (character_id) REFERENCES characters(id)
);
```

## 🔄 Application Flow

### 1. User Workflow
```
Start → Select Tag Filters (optional) → 
Show Random Character Image (from filtered pool) → 
Choose: Vote Yes/No OR Skip → 
Register interaction in DB → Calculate points → 
Show Results + Character Info + Updated User Stats → 
Next Button → Repeat

Vote/Skip: Character marked as seen, won't appear again
Points: 50% = majority, all stats updated and saved to localStorage
```

### 2. API Endpoints
```
GET  /api/character/random?tags=tag1,tag2&exclude=tag3  - Get random character with filtering
POST /api/character/{id}/vote                          - Submit vote (yes/no)  
POST /api/character/{id}/skip                          - Skip character
GET  /api/character/{id}/results                       - Get character info + vote stats
GET  /api/tags                                         - Get all available tags
GET  /api/user/{sessionId}/interactions                - Get user's interaction history
```

## 💾 Database Strategy (Sustainable Approach)

### Why NOT to use simple counters:
- ❌ Can't track voting trends over time
- ❌ Difficult to prevent duplicate votes
- ❌ Limited analytics capabilities

### Recommended Approach:
- ✅ **Store individual interactions** (votes + skips)  
- ✅ **All user stats in localStorage** (no server-side user sessions)
- ✅ **Tag-based character filtering** system
- ✅ **Points calculated after DB registration** (50% = majority)
- ✅ **Skip prevents re-appearance** like voting does
- ✅ **Separate streak + total counters** for different tracking styles

## 🚀 Implementation Phases

### Phase 1: MVP (Minimum Viable Product)
- [ ] Basic HTML/CSS/JS frontend with Vote/Skip options
- [ ] Tag filtering UI (checkboxes/dropdown)
- [ ] Node.js + Express backend
- [ ] SQLite database with character tags
- [ ] Character display, voting, and skipping
- [ ] Simple bar chart for results
- [ ] localStorage-based user stats tracking

### Phase 2: Enhanced Features
- [ ] Better UI/UX with animations
- [ ] Session management (prevent duplicate votes)
- [ ] Admin panel to add characters
- [ ] Mobile responsive design

### Phase 3: Production Ready
- [ ] User accounts (optional)
- [ ] Vote history and trends
- [ ] Character categories/filtering
- [ ] Cloud database migration
- [ ] Performance optimization

## 🛠️ Getting Started Steps

### 1. Set Up Development Environment
```bash
mkdir character-voting-app
cd character-voting-app
npm init -y
npm install express sqlite3 cors multer
```

### 2. Project Structure
```
character-voting-app/
├── public/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── server/
│   ├── server.js
│   ├── database.js
│   └── routes/
├── database/
│   └── characters.db
└── images/
    └── characters/
```

### 3. Sample Backend Code Structure
```javascript
// server.js
const express = require('express');
const cors = require('cors');
const characterRoutes = require('./routes/characters');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', characterRoutes);

app.listen(3000, () => {
    console.log('Server running on port 3000');
});
```

## 📊 Vote Statistics & User Tracking Implementation

### Character Filtering with Tags
```sql
-- Get random character with tag filtering
SELECT * FROM characters 
WHERE id NOT IN (
    SELECT character_id FROM user_interactions WHERE session_id = ?
) 
AND (tags LIKE '%tag1%' OR tags LIKE '%tag2%') 
AND tags NOT LIKE '%excludeTag%'
ORDER BY RANDOM() 
LIMIT 1;
```

### User Stats Calculation & Storage
```javascript
// Complete user stats object for localStorage
const userStats = {
    // Streaks (consecutive)
    majorityStreak: 0,
    minorityStreak: 0,
    
    // Total counters (lifetime)
    majorityTotal: 0,
    minorityTotal: 0,
    
    // Vote type counters
    yesVotesTotal: 0,
    noVotesTotal: 0,
    skipsTotal: 0,
    
    // Points
    majorityPoints: 0,
    minorityPoints: 0,
    
    // Session data
    interactedCharacters: [], // IDs to prevent duplicates
    sessionId: generateSessionId()
};

// Calculate points (50% = majority)
function calculatePoints(isMajority, majorityPercentage) {
    if (majorityPercentage >= 50) {
        // Majority: more points for stronger consensus (50-100%)
        return Math.floor((majorityPercentage - 50) * 2); // 0-100 points
    } else {
        // Minority: more points for smaller minorities (0-49%)  
        return Math.floor((50 - majorityPercentage) * 3); // 3-150 points
    }
}

// Update stats after vote/skip registration in DB
function updateUserStats(voteType, isMajority, majorityPercentage) {
    const stats = getUserStatsFromStorage();
    
    if (voteType !== null) { // Only for votes, not skips
        // Update vote counters
        if (voteType) stats.yesVotesTotal++;
        else stats.noVotesTotal++;
        
        // Update majority/minority stats
        if (majorityPercentage >= 50) {
            stats.majorityTotal++;
            stats.majorityStreak++;
            stats.minorityStreak = 0; // Reset minority streak
            stats.majorityPoints += calculatePoints(true, majorityPercentage);
        } else {
            stats.minorityTotal++;
            stats.minorityStreak++;
            stats.majorityStreak = 0; // Reset majority streak  
            stats.minorityPoints += calculatePoints(false, majorityPercentage);
        }
    } else {
        stats.skipsTotal++;
    }
    
    saveUserStatsToStorage(stats);
    return stats;
}
```

### Character Tag Management
```sql
-- Get all unique tags for filter UI
SELECT DISTINCT TRIM(tag) as tag 
FROM (
    SELECT TRIM(SUBSTR(tags, 1, INSTR(tags||',', ',')-1)) as tag FROM characters
    UNION ALL
    SELECT TRIM(SUBSTR(tags, INSTR(tags, ',')+1)) as tag FROM characters 
    WHERE INSTR(tags, ',') > 0
) 
WHERE tag != '';
```

## 🔒 Preventing Duplicate Characters

### localStorage-Based Approach  
- Generate unique session ID on first visit
- Store in browser localStorage with all user stats
- Track all character interactions to prevent re-appearance
- Both votes AND skips mark character as "seen"

### Character Pool Management
```javascript
// Get available characters based on filters and interaction history
async function getAvailableCharacters(tagFilters, excludeTags) {
    const stats = getUserStatsFromStorage();
    const interactedIds = stats.interactedCharacters;
    
    const response = await fetch(`/api/character/random?` +
        `tags=${tagFilters.join(',')}&` +
        `exclude=${excludeTags.join(',')}&` +
        `excludeIds=${interactedIds.join(',')}`
    );
    
    return response.json();
}
```

## 🎨 Frontend State Management

### Enhanced State Management with Tags
```javascript
const appState = {
    currentCharacter: null,
    hasInteracted: false,
    interactionType: null, // 'vote', 'skip', or null
    voteResults: null,
    
    // Tag filtering
    selectedTags: [],
    excludedTags: [],
    availableTags: [],
    
    // User stats (synced with localStorage)
    userStats: {
        majorityStreak: 0,
        minorityStreak: 0,
        majorityTotal: 0,
        minorityTotal: 0,
        yesVotesTotal: 0,
        noVotesTotal: 0,
        skipsTotal: 0,
        majorityPoints: 0,
        minorityPoints: 0,
        interactedCharacters: [],
        sessionId: null
    }
};

// localStorage management
function saveUserStatsToStorage(stats) {
    localStorage.setItem('characterVotingStats', JSON.stringify(stats));
}

function getUserStatsFromStorage() {
    const stored = localStorage.getItem('characterVotingStats');
    return stored ? JSON.parse(stored) : appState.userStats;
}
```

## 🎯 Enhanced User Experience Features

### Skip Functionality Benefits
- Users can explore characters without pressure to vote
- **Skip prevents character re-appearance** (same as voting)
- Still contributes to character view statistics  
- Allows users to "save" interesting characters for later (outside app)

### Comprehensive Stats System
- **Streaks**: Consecutive majority/minority predictions (reset on opposite)
- **Totals**: Lifetime counters for majority/minority alignment  
- **Vote Counters**: Track yes/no voting patterns
- **Smart Points**: Scale with consensus strength (50% exactly = majority)

### Tag Filtering System
```javascript
// Example tag filter UI
function buildTagFilterUI(availableTags) {
    const filterContainer = document.querySelector('.tag-filters');
    
    availableTags.forEach(tag => {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `tag-${tag}`;
        checkbox.value = tag;
        
        const label = document.createElement('label');
        label.htmlFor = `tag-${tag}`;
        label.textContent = tag;
        
        filterContainer.appendChild(checkbox);
        filterContainer.appendChild(label);
    });
}

// Apply filters when getting random character
async function getNextCharacter() {
    const selectedTags = getSelectedTags();
    const excludedTags = getExcludedTags();
    
    const character = await getAvailableCharacters(selectedTags, excludedTags);
    return character;
}
```

### Complete Interaction Flow
```javascript
// After vote/skip is registered in database
async function processInteraction(characterId, action, voteType = null) {
    // 1. Register in database first
    await registerInteraction(characterId, action, voteType);
    
    // 2. Get current vote statistics  
    const voteStats = await getVoteStatistics(characterId);
    
    // 3. Calculate if user was in majority (50% = majority)
    const majorityPercentage = voteStats.yesVotes / voteStats.totalVotes * 100;
    const userVotedYes = voteType === true;
    const isMajority = (userVotedYes && majorityPercentage >= 50) || 
                      (!userVotedYes && majorityPercentage < 50);
    
    // 4. Update user stats in localStorage
    const updatedStats = updateUserStats(voteType, isMajority, majorityPercentage);
    
    // 5. Mark character as seen
    updatedStats.interactedCharacters.push(characterId);
    saveUserStatsToStorage(updatedStats);
    
    // 6. Show results and updated stats
    displayResults(voteStats, updatedStats);
}
```

### For Future Growth:
- **Caching**: Redis for frequently accessed data
- **CDN**: For character images
- **Database**: PostgreSQL with connection pooling
- **Load Balancing**: Multiple server instances
- **Analytics**: Track voting patterns and popular characters

## 📈 Scalability Considerations

1. **Don't store images in database** - use file system or cloud storage
2. **Don't use auto-incrementing counters** - store individual votes
3. **Don't skip input validation** - sanitize all user inputs
4. **Don't ignore error handling** - plan for database failures
5. **Don't hardcode character data** - use seeded database

## 🎯 Success Metrics

- Vote submission response time < 200ms
- Character loading time < 1s
- Support for 100+ concurrent users
- 99.9% uptime
- Mobile-friendly interface

## 📚 Learning Resources

- **Database Design**: SQLite Tutorial, PostgreSQL docs
- **Backend**: Express.js guides, RESTful API design
- **Frontend**: MDN Web Docs, Chart.js documentation
- **Deployment**: Vercel/Netlify guides

This approach gives you a solid foundation that can grow with your skills and user base!