<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# JustPush

AI-powered Infrastructure as Code generator for Kubernetes deployments using Terraform and Google Gemini AI.

## Features

- 🤖 AI-powered Terraform code generation using Google Gemini
- 🐳 Kubernetes deployment configuration
- 📁 Directory-based project management
- ⚡ Real-time Terraform execution (init, plan, apply)
- 💻 Interactive terminal simulation
- 📦 File download and export capabilities
- 🎨 Modern React-based UI

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Google Gemini API key
- Terraform (for local execution)
- kubectl (optional, for cluster interaction)

## Setup

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` and set your Gemini API key:
   ```
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   ```

3. **Configure Kubernetes (optional):**
   - Place your `kubeconfig.yaml` in the project root
   - Update cluster information in the environment variables if needed

## Running the Application

### Development Mode (Frontend + Backend)
```bash
npm start
```
This runs both the React frontend (port 3001) and Express backend (port 9000) concurrently.

### Production Build
```bash
npm run build
npm run server
```

### Individual Services

**Frontend only:**
```bash
npm run dev
```

**Backend only:**
```bash
npm run server
```

## Usage

1. Open the application in your browser
2. Describe your infrastructure requirements in natural language
3. Click "Generate Terraform" to create Kubernetes resources
4. Review the generated Terraform files
5. Click "APPLY" to execute Terraform commands in real-time
6. Download individual files or use "Download All" for the complete project

## API Endpoints

- `POST /api/generate` - Generate Terraform configuration
- `POST /api/terraform/:command` - Execute Terraform commands (init, plan, apply, destroy)
- `GET /api/projects/:projectName/files` - Get project files

## Project Structure

```
├── components/           # React components
│   ├── CodeViewer.tsx   # File viewer with syntax highlighting
│   └── Terminal.tsx     # Interactive terminal component
├── services/            # API services
│   └── geminiService.ts # Gemini AI integration
├── server.js           # Express backend server
├── kubeconfig.yaml     # Kubernetes configuration
└── projects/           # Generated Terraform projects (auto-created)
```

## Configuration

The application uses the following environment variables:

- `GEMINI_API_KEY` - Your Google Gemini API key
- `PORT` - Backend server port (default: 9000)
- `KUBECONFIG_PATH` - Path to kubeconfig file
- `DEFAULT_NAMESPACE` - Default Kubernetes namespace

## Troubleshooting

### Common Issues

1. **"API Key is missing" error:**
   - Ensure `GEMINI_API_KEY` is set in `.env.local`
   - Verify the API key is valid and has proper permissions

2. **"Failed to generate configuration" error:**
   - Check your internet connection
   - Verify Gemini API quota and billing status
   - Check server logs for detailed error messages

3. **Port conflicts:**
   - Frontend runs on port 3001, backend on 9000
   - Change ports in `.env.local` if needed

### Terraform Execution

The application can execute real Terraform commands if:
- Terraform is installed on the system
- Proper kubeconfig is configured
- Network access to Kubernetes cluster

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.
