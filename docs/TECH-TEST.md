# WSD Full-Stack JavaScript Technical Test

## Test Instructions

### Important Note on AI Usage
**AI coding assistants (GitHub Copilot, Claude, ChatGPT, etc.) are encouraged and expected to be used for this test.** However:
- You **MUST** review and understand every line of code generated
- You **MUST** be able to explain and justify all implementation decisions
- During the technical interview, you will be asked to walk through your code and explain your approach
- Failure to explain your code will result in immediate disqualification

### Time Allocation
This test is designed to take **2-3 hours** for a developer using AI coding assistants effectively. The focus is on demonstrating your ability to work with AI tools while maintaining code quality and understanding.

## Task Overview

You will extend the existing **Task Analytics Dashboard** by implementing a **Task Export and Advanced Filtering System**. This feature should demonstrate your full-stack development skills with Vue.js 3, Node.js, MongoDB, Redis, and real-time WebSocket communication.

## Current System Overview

The existing application is a real-time task analytics dashboard with:
- **Backend**: Node.js with Express.js, MongoDB (Mongoose), Redis caching, Socket.IO
- **Frontend**: Vue.js 3 SPA with Vuetify 3, Pinia state management, real-time updates
- **Features**: Task CRUD operations, real-time analytics, pagination, filtering, charts

## Business Requirements

### Core Feature: Task Export System
Users need the ability to export their task data for external analysis and reporting. The export system should:

1. **Allow filtered exports** - Users should be able to export only the tasks that match specific criteria
2. **Support multiple formats** - Provide exports in both CSV and JSON formats
3. **Track export history** - Keep a record of when exports were performed for auditing
4. **Provide real-time feedback** - Show users the progress and completion of exports
5. **Cache results** - Avoid regenerating identical exports to improve performance

### Technical Constraints
- Must integrate with the existing codebase architecture
- Should follow the established patterns for API design, state management, and UI components
- Export files should be generated server-side for security and performance
- Real-time updates should use the existing Socket.IO infrastructure

## Implementation Requirements

### Part 1: Backend API Development

#### 1.1 Enhanced Task Filtering
The existing task API needs additional filtering capabilities to support the export feature. Consider what filtering options would be most valuable for users exporting task data.

**Key Considerations:**
- How should date-based filtering work?
- What search functionality would be most useful?
- How can multiple filter criteria be combined effectively?

#### 1.2 Export API Design
Design and implement an export system that can generate task data in different formats.

**Key Considerations:**
- What's the best API design for export endpoints?
- How should export format be specified?
- How can you ensure exports are efficient for large datasets?
- What response format should you use for export requests?

#### 1.3 Export Tracking
Implement a system to track export history for auditing and user reference.

**Key Considerations:**
- What data should be stored about each export?
- How should export history be structured in the database?
- What API endpoints are needed for accessing export history?

#### 1.4 Performance Optimization
Implement caching to improve export performance and reduce server load.

**Key Considerations:**
- When should export results be cached?
- How long should cache entries be valid?
- When should caches be invalidated?
- How can you generate effective cache keys?

#### 1.5 Real-time Features
Integrate export functionality with the existing real-time system.

**Key Considerations:**
- What events should be broadcast during export operations?
- How can you provide progress feedback for long-running exports?
- How should export metrics be integrated into the analytics system?

### Part 2: Frontend User Interface

#### 2.1 Advanced Filtering Interface
Create an enhanced filtering system that allows users to refine their task data before export.

**Key Considerations:**
- What filtering options should be prominently displayed vs. hidden in advanced settings?
- How can you make complex filters user-friendly?
- What's the best way to show which filters are currently active?
- How should filter state be managed in the application?

#### 2.2 Export User Interface
Design and implement an intuitive interface for data export functionality.

**Key Considerations:**
- Where should export functionality be placed in the existing UI?
- How should users select export format and options?
- What feedback should users receive during export processing?
- How should completed exports be presented to users?

#### 2.3 Export History Management
Provide users with visibility into their export history and the ability to access previous exports.

**Key Considerations:**
- How should export history be displayed?
- What information about each export is most important to show?
- Should this be a separate page or integrated into existing views?
- How can users easily re-download or repeat previous exports?

#### 2.4 Dashboard Integration
Integrate the export functionality into the existing dashboard experience.

**Key Considerations:**
- How should export metrics be displayed alongside existing analytics?
- Where does export functionality fit in the current navigation?
- How can you maintain the dashboard's clean design while adding new features?

#### 2.5 Real-time User Experience
Enhance the user experience with real-time feedback and updates.

**Key Considerations:**
- How should users be notified about export progress and completion?
- What real-time updates would be most valuable for the export feature?
- How can you handle connection issues gracefully during exports?

### Part 3: Quality & Testing

#### 3.1 Error Handling & Edge Cases
Ensure robust error handling throughout the export system.

**Key Considerations:**
- What could go wrong during export operations?
- How should different types of errors be communicated to users?
- What happens if exports fail midway through processing?
- How should you handle invalid or conflicting filter parameters?

#### 3.2 Testing Strategy
Develop comprehensive tests for your new functionality.

**Key Considerations:**
- What are the most critical parts of your implementation to test?
- How can you test real-time features effectively?
- What edge cases should your tests cover?
- How can you ensure your tests provide meaningful validation?

#### 3.3 Performance & Scalability
Consider the performance implications of your implementation.

**Key Considerations:**
- How will your solution perform with large datasets?
- What bottlenecks might exist in your implementation?
- How can you optimize database queries for filtering and exporting?
- What caching strategies will be most effective?

## Technical Guidelines

### Integration Requirements
- **Follow existing patterns**: Study the current codebase architecture and maintain consistency
- **Reuse existing infrastructure**: Leverage the established MongoDB, Redis, and Socket.IO connections
- **Maintain API standards**: Follow the existing response format and error handling patterns
- **Code quality**: Ensure your code meets the same standards as the existing codebase

### Development Approach
- **Start simple**: Begin with basic functionality and iterate
- **Think about UX**: Consider how users will interact with your features
- **Document decisions**: Be prepared to explain your architectural choices
- **Test early**: Write tests as you develop, don't leave them until the end

## Evaluation Criteria

### Technical Implementation (60%)
1. **Functionality** (20%): Core export and filtering features work correctly
2. **Code Architecture** (20%): Well-structured, follows existing patterns, integrates seamlessly
3. **Code Quality** (10%): Clean, maintainable code with appropriate documentation
4. **Testing** (10%): Adequate test coverage with meaningful test cases

### Design & User Experience (25%)
1. **User Interface Design**: Intuitive and well-integrated UI components
2. **User Experience Flow**: Logical and efficient user workflows
3. **Error Handling**: Graceful error handling with helpful user feedback
4. **Performance**: Responsive interface with appropriate loading states

### AI Usage & Technical Understanding (15%)
1. **Code Explanation**: Ability to explain all implementation decisions and trade-offs
2. **Problem-Solving Approach**: How you guided AI tools vs. letting them decide
3. **Architecture Decisions**: Understanding of why you chose specific approaches
4. **Integration Challenges**: How you handled integration with existing codebase

### Differentiating Factors

**Strong Candidates Will:**
- Make thoughtful architectural decisions and be able to explain the trade-offs
- Demonstrate deep understanding of the existing codebase patterns
- Show good judgment in UI/UX design decisions
- Implement robust error handling and edge case management
- Write meaningful tests that actually validate functionality
- Use AI tools effectively while maintaining code quality

**Weak Candidates Will:**
- Implement basic functionality without considering architecture or UX
- Copy AI-generated code without understanding or customization
- Miss integration opportunities with existing systems
- Have minimal or ineffective error handling
- Write superficial tests that don't validate real functionality
- Be unable to explain their implementation decisions

## Bonus Considerations (Optional)
These are not required but demonstrate additional expertise:
- Thoughtful performance optimizations
- Creative solutions to complex problems
- Advanced UI/UX enhancements
- Innovative use of existing system capabilities
- Extensible architecture for future enhancements

## Submission Instructions

### 1. Development Process
1. **Fork** this repository to your GitHub account
2. Create a feature branch with a descriptive name
3. Implement the requirements, making thoughtful decisions about architecture and UX
4. Commit frequently with meaningful commit messages
5. Ensure all existing tests continue to pass
6. Add tests for your new functionality

### 2. Documentation
In your Pull Request description, include:
- **Feature Overview**: What you built and why you made specific design choices
- **AI Usage**: How you used AI tools and what decisions you made vs. what the AI suggested
- **Architecture Decisions**: Key technical choices and their trade-offs
- **Integration Approach**: How you integrated with the existing codebase
- **Testing Strategy**: Your approach to testing the new functionality
- **Known Limitations**: Any constraints or areas for future improvement

### 3. Final Submission
1. Create a **Pull Request** from your feature branch to the main branch
2. Ensure the CI/CD pipeline passes (tests + linting)
3. The PR should be ready for production deployment

### 4. Interview Preparation
During the technical interview, you'll be asked to:
- **Walk through your code**: Explain your implementation approach and key components
- **Justify design decisions**: Why did you choose specific approaches over alternatives?
- **Discuss AI usage**: How did you guide AI tools vs. accepting their suggestions?
- **Explain integration**: How does your code fit with the existing architecture?
- **Demonstrate functionality**: Show the working feature and explain the user experience
- **Discuss testing**: Explain your testing strategy and demonstrate test coverage

## Getting Started

### 1. Setup Environment
```bash
# Clone your forked repository
git clone https://github.com/yourusername/wsd-fullstack-js-tech-test.git
cd wsd-fullstack-js-tech-test

# Start databases
docker-compose up -d

# Setup backend
cd backend
cp .env.example .env
npm install
npm run seed  # Generate sample data
npm run dev

# Setup frontend (new terminal)
cd frontend
cp .env.example .env
npm install
npm run dev
```

### 2. Understand the Existing System
Before implementing new features, spend time understanding:
- How the current task management system works
- The existing API patterns and data structures
- How the Vue.js components are organized and styled
- How real-time features are implemented
- The current testing approach and coverage

### 3. Plan Your Approach
Consider how you'll approach this problem:
- What's the minimal viable implementation?
- How can you build incrementally?
- Where do you need to make architectural decisions?
- What could go wrong and how will you handle it?

## Success Indicators

**Core Requirements:**
- Export functionality works reliably for different data sets and formats
- Filtering enhancements integrate smoothly with existing UI
- Real-time features provide appropriate user feedback
- All existing functionality continues to work
- Code maintains established quality standards
- Meaningful tests cover your new functionality

**Excellence Indicators:**
- Thoughtful user experience design
- Robust error handling and edge case management
- Performance considerations for large datasets
- Clean integration with existing architecture
- Comprehensive understanding of implementation decisions

## Important Notes

- This test evaluates your **problem-solving approach** as much as your coding skills
- **Decision-making** is more important than perfect implementation
- **Integration quality** matters more than feature completeness
- **Understanding** your code is more important than clever solutions

The goal is to demonstrate that you can work effectively with AI tools while maintaining the judgment and understanding necessary to build production-quality software that integrates well with existing systems.