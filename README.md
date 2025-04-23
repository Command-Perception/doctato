# doctato

## AI-Powered Codebase Tutorial Generator

Doctato automatically transforms complex codebases into beginner-friendly tutorials. Simply enter a GitHub repository URL or upload a local project zip, and let AI do the rest.

## Features

- **GitHub Repository Analysis**: Analyze any public GitHub repository
- **Local Project Support**: Upload zip files of your local projects
- **Beginner-Friendly Tutorials**: AI-generated explanations that break down complex code
- **Core Abstraction Identification**: Automatically identifies key components and how they interact
- **Customizable Options**: Configure file types to include/exclude and more

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- A GitHub token (optional, for higher rate limits when accessing repositories)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/doctato.git
cd doctato

# Install dependencies
bun install
```

### Development

```bash
# Start the development server
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

### Build for Production

```bash
# Build the application
bun run build

# Start the production server
bun start
```

## Usage

1. Visit the homepage
2. Enter a GitHub repository URL or upload a ZIP file of your local project
3. Configure optional settings:
   - Specify file types to include/exclude
   - Set maximum file size
   - Choose output language
4. Click "Generate Tutorial"
5. Wait for the AI to analyze the codebase and generate a tutorial
6. Explore the generated tutorial

## Technologies

- **Next.js**: React framework for server-rendered applications
- **React**: UI library
- **Tailwind CSS**: Utility-first CSS framework
- **Google Generative AI API**: Powers the AI analysis and tutorial generation
- **TypeScript**: Typed JavaScript for better development experience

## Future Improvements

- Robust error handling with specific feedback
- Progress indication for long-running generations (SSE/WebSockets)
- Advanced caching with Redis or database persistence
- Enhanced security with GitHub OAuth
- Improved UI/UX with better form layout and tooltips
- Parallel processing for faster tutorial generation
- Configuration options for LLM parameters
- Comprehensive testing

## Inspiration

This project is heavily inspired by [Tutorial-Codebase-Knowledge](https://github.com/The-Pocket/Tutorial-Codebase-Knowledge), a Python-based tool that turns codebases into easy tutorials with AI.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
