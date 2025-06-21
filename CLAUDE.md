# Claude Code Instructions

## Project Overview
This is a real Production project built with node.js, vue and redis. The repository contains a complete Task Analytics Dashboard built with Vue.js 3, Node.js, MongoDB, Redis, and Socket.IO.

## Repository Structure
- **`/backend`** - Node.js/Express.js API with MongoDB and Redis
- **`/frontend`** - Vue.js 3 SPA with Vuetify 3 and Pinia
- **`/docs`** - Documentation and test specifications
- **`/docs/private`** - Internal evaluation materials (not for candidates)

## Key Commands

### Development
```bash
# Start databases
docker-compose up -d

# Backend development
cd backend && npm run dev

# Frontend development  
cd frontend && npm run dev

# Generate sample data
cd backend && npm run seed
```

### Testing
```bash
# Backend tests
cd backend && npm test
cd backend && npm run test:coverage

# Frontend tests
cd frontend && npm test
cd frontend && npm run test:coverage
```

### Code Quality
```bash
# Backend linting
cd backend && npm run lint

# Frontend linting
cd frontend && npm run lint
```

## Files to Know

### Technical Test
- **`/docs/TECH-TEST.md`** - Main technical test specification for candidates
- **`/docs/TEST-REPORT.md`** - Template for candidate feedback reports

### Evaluation System
- **Private evaluation files** - Stored separately from this public repository to prevent candidate access
- **`/docs/TEST-REPORT.md`** - Template for candidate feedback reports

### Core Application Files
- **Backend entry**: `/backend/src/index.js`
- **Frontend entry**: `/frontend/src/main.js`
- **Task model**: `/backend/src/models/Task.js`
- **API routes**: `/backend/src/routes/api.js`
- **Analytics service**: `/backend/src/services/analyticsService.js`

## When Evaluating Submissions

### Setup Process
1. Checkout the candidate's branch
2. Follow setup instructions in the private evaluation documentation
3. Test that existing functionality still works
4. Evaluate new functionality systematically

### Evaluation Focus
- **Technical Implementation** (60%) - Functionality, architecture, code quality, testing
- **Design & User Experience** (25%) - UI design, UX flow, error handling, performance  
- **AI Usage & Understanding** (15%) - Code explanation readiness, problem-solving approach

### Key Red Flags
- Breaking existing functionality
- Poor integration with existing patterns
- Evidence of blind AI code acceptance
- Security vulnerabilities or performance issues
- Inability to explain implementation decisions

## Development Context
- **Node.js version**: v24+ (specified in package.json engines)
- **Code style**: ESLint with Google JavaScript Style Guide (backend), Vue.js style guide (frontend)
- **Testing**: Node.js built-in test runner (backend), Vitest (frontend)
- **Real-time**: Socket.IO for live updates and notifications
- **Caching**: Redis for individual task lookups and analytics
- **Database**: MongoDB with Mongoose ODM

## Important Notes
- The technical test is designed for 2-3 hours with AI assistance
- Candidates are expected to use AI tools but must understand all code
- Focus is on integration quality and architectural decisions, not perfect implementation
- The evaluation system is designed to differentiate between thoughtful AI usage vs. blind acceptance
