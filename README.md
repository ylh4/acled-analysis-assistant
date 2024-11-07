# ACLED Data Analysis Assistant

An interactive application dedicated to analyzing Armed Conflict Location & Event Data Project (ACLED) data, providing insights about recent conflict trends through natural language queries.

## Overview

This application serves as an AI-powered interface to the ACLED database, allowing users to:
- Query conflict data using natural language
- Analyze recent conflict trends and patterns
- Get detailed insights about specific regions or event types
- Visualize ACLED data through structured responses

## Features

- **Natural Language Processing**: Ask questions about conflict data in plain English
- **Real-time Data Access**: Connected to ACLED's API for up-to-date conflict information
- **Intelligent Query Processing**: AI-powered system that:
  - Understands complex questions about conflict data
  - Generates appropriate SQL queries
  - Provides formatted, human-readable responses
  - Handles both specific data questions and general inquiries

## Example Queries

You can ask questions like:
- "Using the event_type column, what are the different types of events recorded?"
- "Using the country, region, and fatalities columns, what are the top 5 regions with the highest fatalities?"
- "Using the actor1, assoc_actor_1, and event_type columns, show events where military forces were involved as primary actors"
- "Using the location, latitude, and longitude columns, list all events in capital cities"
- "Using the admin1, admin2, and fatalities columns, which administrative regions had the most civilian casualties?"

## Local Development Setup

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- SQLite
- OpenAI API key

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone [repository-url]
   cd acled-analysis-assistant
   ```

2. **Set up environment variables**
   Create a `.env` file in the server directory:
   ```
   PORT=3000
   OPENAI_API_KEY=your_api_key_here
   ACLED_API_KEY=your_acled_api_key
   ACLED_EMAIL=your_registered_email
   ```

3. **Install dependencies**
   ```bash
   # Install server dependencies
   cd server
   npm install

   # Install client dependencies
   cd ../client
   npm install
   ```

4. **Initialize the database**
   ```bash
   cd server
   npm run init-db
   ```

5. **Start the development servers**
   ```bash
   # Start the backend server
   cd server
   npm run dev

   # In a new terminal, start the frontend
   cd client
   npm run dev
   ```

6. **Access the application**
   Open your browser and navigate to `http://localhost:3000`

## Usage Guidelines

1. **Enter your question** in the input field using natural language
2. **Wait for processing** as the system analyzes your query
3. **Review the response** which includes:
   - A natural language answer
   - Relevant data points
   - SQL query used (if applicable)
   - Any visualizations or structured data

## Technical Architecture

- **Frontend**: React with TypeScript
- **Backend**: Node.js/Express
- **Database**: SQLite
- **AI Processing**: OpenAI API
- **Data Source**: ACLED API

## API Rate Limits

- ACLED API has specific rate limits for data fetching
- Ensure compliance with ACLED's terms of service
- Consider implementing caching for frequently requested data

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting pull requests.

## License

[Your chosen license]

## Acknowledgments

- ACLED for providing the conflict data
- OpenAI for the language processing capabilities

## Support

For issues, questions, or contributions, please open an issue in the GitHub repository.

---

**Note**: This application is for research and analytical purposes only. Always verify critical information through official ACLED channels.