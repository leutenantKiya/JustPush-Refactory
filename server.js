import express from 'express';
import { GoogleGenAI } from "@google/genai";
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config({ path: '.env.local' });

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 9001;

app.use(cors());
app.use(express.json());

// Define the schema for the AI response
const responseSchema = {
  type: "object",
  properties: {
    files: {
      type: "array",
      items: {
        type: "object",
        properties: {
          filename: {
            type: "string",
            description: "The name of the file including extension (e.g., main.tf)"
          },
          content: {
            type: "string",
            description: "The complete source code content of the file"
          },
          language: {
            type: "string",
            description: "The programming language (e.g., hcl, yaml, json)"
          },
          description: {
            type: "string",
            description: "A short one-sentence description of what this file does"
          }
        },
        required: ["filename", "content", "language", "description"]
      }
    },
    summary: {
      type: "string",
      description: "A brief technical summary of the infrastructure architecture generated."
    }
  },
  required: ["files", "summary"]
};

// Helper function to get kubeconfig info
const getKubeconfigInfo = () => {
  return {
    server: 'https://103.185.52.178:6443',
    context: 'mau-menang',
    configPath: path.join(__dirname, 'kubeconfig.yaml')
  };
};

// Helper function to check if Terraform is installed
const checkTerraformInstalled = () => {
  return new Promise((resolve) => {
    exec('terraform version', (error, stdout, stderr) => {
      if (error) {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
};

// Helper function to extract Terraform code from text response
const extractTerraformFromText = (text) => {
  const files = [];

  // Try to extract sections with ## headers (e.g., ## main.tf)
  const sectionRegex = /##\s+([^\n]+)\s*\n```hcl?\s*\n([\s\S]*?)```/g;
  let match;

  while ((match = sectionRegex.exec(text)) !== null) {
    const filename = match[1].trim();
    const content = match[2].trim();

    let description;
    if (filename.includes('provider')) {
      description = 'Provider configuration for Kubernetes';
    } else if (filename.includes('variable')) {
      description = 'Input variables for the deployment';
    } else if (filename.includes('output')) {
      description = 'Output values from the deployment';
    } else if (filename.includes('main')) {
      description = 'Main Terraform resources configuration';
    } else {
      description = 'Terraform configuration file';
    }

    files.push({
      filename,
      content,
      language: 'hcl',
      description
    });
  }

  // If no sections found, try to extract code blocks
  if (files.length === 0) {
    const codeBlockRegex = /```(?:hcl|terraform|tf)?\s*\n?([\s\S]*?)```/g;
    const extractedBlocks = [];

    while ((match = codeBlockRegex.exec(text)) !== null) {
      extractedBlocks.push(match[1].trim());
    }

    extractedBlocks.forEach((block, index) => {
      let filename, description;

      // Determine file type based on content
      if (block.includes('provider')) {
        filename = 'provider.tf';
        description = 'Provider configuration for Kubernetes';
      } else if (block.includes('variable')) {
        filename = 'variables.tf';
        description = 'Input variables for the deployment';
      } else if (block.includes('output')) {
        filename = 'outputs.tf';
        description = 'Output values from the deployment';
      } else if (block.includes('resource')) {
        filename = 'main.tf';
        description = 'Main Terraform resources configuration';
      } else {
        filename = `config-${index + 1}.tf`;
        description = 'Terraform configuration file';
      }

      files.push({
        filename,
        content: block,
        language: 'hcl',
        description
      });
    });
  }

  // If still no files, try to extract Terraform code directly
  if (files.length === 0) {
    const terraformRegex = /(resource|provider|variable|output|module|data|terraform|locals)\s+["\w]+/g;
    const terraformMatches = text.match(terraformRegex);

    if (terraformMatches) {
      // Split text by common Terraform keywords and create files
      const parts = text.split(/(?=resource|variable|output|provider)/);

      parts.forEach((part, index) => {
        if (part.trim() && part.length > 50) { // Only meaningful content
          let filename, description;
          if (part.includes('resource')) {
            filename = 'main.tf';
            description = 'Main Terraform resources configuration';
          } else if (part.includes('variable')) {
            filename = 'variables.tf';
            description = 'Input variables configuration';
          } else if (part.includes('output')) {
            filename = 'outputs.tf';
            description = 'Output values configuration';
          } else if (part.includes('provider')) {
            filename = 'provider.tf';
            description = 'Provider configuration';
          } else {
            filename = `config-${index}.tf`;
            description = 'Terraform configuration';
          }

          files.push({
            filename,
            content: part.trim(),
            language: 'hcl',
            description
          });
        }
      });
    }
  }

  // Ensure we have at least the basic files
  if (files.length === 0) {
    files.push({
      filename: 'main.tf',
      content: `# Generated Terraform configuration
# AI Response: ${text.substring(0, 200)}...
# Please check the full AI response for the actual code`,
      language: 'hcl',
      description: 'Main Terraform configuration'
    });
  }

  return {
    files,
    summary: 'Terraform configuration generated from AI response'
  };
};

const generateInfrastructure = async (userPrompt) => {
  console.log('Generating Terraform for:', userPrompt);

  const kubeconfigInfo = getKubeconfigInfo();
  const prompt = userPrompt.toLowerCase();

  // Detect application type from prompt
  let appConfig;
  let detectedApp = 'apache'; // default

  if (prompt.includes('phpmyadmin') || prompt.includes('pma') || prompt.includes('phpmyadmin')) {
    console.log('Detected: phpMyAdmin');
    detectedApp = 'phpmyadmin';
    appConfig = generatePhpMyAdminConfig(kubeconfigInfo);
  } else if (prompt.includes('nginx')) {
    console.log('Detected: Nginx');
    detectedApp = 'nginx';
    appConfig = generateNginxConfig(kubeconfigInfo, prompt);
  } else if (prompt.includes('mysql') || prompt.includes('mariadb') || prompt.includes('database')) {
    console.log('Detected: MySQL');
    detectedApp = 'mysql';
    appConfig = generateMySQLConfig(kubeconfigInfo, prompt);
  } else if (prompt.includes('redis') || prompt.includes('cache')) {
    console.log('Detected: Redis');
    detectedApp = 'redis';
    appConfig = generateRedisConfig(kubeconfigInfo, prompt);
  } else if (prompt.includes('apache') || prompt.includes('web server') || prompt.includes('webserver')) {
    console.log('Detected: Apache');
    detectedApp = 'apache';
    appConfig = generateApacheConfig(kubeconfigInfo, prompt);
  } else {
    console.log('Detected: Default (Apache)');
    appConfig = generateApacheConfig(kubeconfigInfo, prompt);
  }

  console.log('Final detection result:', detectedApp);
  return appConfig;
};

// Generate phpMyAdmin configuration
const generatePhpMyAdminConfig = (kubeconfigInfo) => {
  return {
    files: [
      {
        filename: 'provider.tf',
        content: `# Kubernetes Provider Configuration
terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
  }
}

provider "kubernetes" {
  config_path    = "./kubeconfig.yaml"
  config_context = "${kubeconfigInfo.context}"
}`,
        language: 'hcl',
        description: 'Kubernetes provider configuration'
      },
      {
        filename: 'variables.tf',
        content: `# Input Variables
variable "namespace" {
  description = "Kubernetes namespace"
  type        = string
  default     = "${kubeconfigInfo.context}"
}

variable "app_name" {
  description = "Application name"
  type        = string
  default     = "phpmyadmin"
}

variable "service_port" {
  description = "Service port"
  type        = number
  default     = 30091
}

variable "mysql_host" {
  description = "MySQL server host"
  type        = string
  default     = "mysql-service"
}

variable "mysql_port" {
  description = "MySQL server port"
  type        = number
  default     = 3306
}`,
        language: 'hcl',
        description: 'Input variables for phpMyAdmin deployment'
      },
      {
        filename: 'main.tf',
        content: `# phpMyAdmin Deployment
resource "kubernetes_deployment" "phpmyadmin" {
  metadata {
    name      = var.app_name
    namespace = var.namespace
    labels = {
      app = var.app_name
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = var.app_name
      }
    }

    template {
      metadata {
        labels = {
          app = var.app_name
        }
      }

      spec {
        container {
          image = "phpmyadmin/phpmyadmin:latest"
          name  = "phpmyadmin"

          port {
            container_port = 80
            name           = "http"
          }

          env {
            name  = "PMA_HOST"
            value = var.mysql_host
          }

          env {
            name  = "PMA_PORT"
            value = var.mysql_port
          }

          env {
            name  = "PMA_USER"
            value = "root"
          }

          env {
            name  = "PMA_PASSWORD"
            value = "password"
          }

          resources {
            limits = {
              cpu    = "200m"
              memory = "256Mi"
            }
            requests = {
              cpu    = "100m"
              memory = "128Mi"
            }
          }

          liveness_probe {
            http_get {
              path = "/"
              port = 80
            }
            initial_delay_seconds = 30
            period_seconds        = 10
          }

          readiness_probe {
            http_get {
              path = "/"
              port = 80
            }
            initial_delay_seconds = 5
            period_seconds        = 5
          }
        }
      }
    }
  }
}

# phpMyAdmin Service
resource "kubernetes_service" "phpmyadmin" {
  metadata {
    name      = "\${var.app_name}-service"
    namespace = var.namespace
    labels = {
      app = var.app_name
    }
  }

  spec {
    selector = {
      app = var.app_name
    }

    port {
      port        = var.service_port
      target_port = 80
      protocol    = "TCP"
    }

    type = "NodePort"
  }
}`,
        language: 'hcl',
        description: 'Main Terraform resources for phpMyAdmin deployment'
      },
      {
        filename: 'outputs.tf',
        content: `# Output Values
output "deployment_name" {
  description = "Name of the phpMyAdmin deployment"
  value       = kubernetes_deployment.phpmyadmin.metadata[0].name
}

output "service_name" {
  description = "Name of the phpMyAdmin service"
  value       = kubernetes_service.phpmyadmin.metadata[0].name
}

output "service_port" {
  description = "Port where phpMyAdmin is accessible"
  value       = kubernetes_service.phpmyadmin.spec[0].port[0].port
}

output "namespace" {
  description = "Namespace where resources are deployed"
  value       = var.namespace
}

output "mysql_host" {
  description = "Configured MySQL host"
  value       = var.mysql_host
}`,
        language: 'hcl',
        description: 'Output values from the phpMyAdmin deployment'
      }
    ],
    summary: 'phpMyAdmin deployment with MySQL server configuration, accessible on port 30091'
  };
};

// Generate Apache configuration
const generateApacheConfig = (kubeconfigInfo, prompt) => {
  // Extract replica count from prompt
  const replicaMatch = prompt.match(/(\d+)\s*replica/i);
  const replicas = replicaMatch ? parseInt(replicaMatch[1]) : 3;

  // Extract port from prompt
  const portMatch = prompt.match(/port\s*(\d+)/i);
  const servicePort = portMatch ? parseInt(portMatch[1]) : 30090;

  return {
    files: [
      {
        filename: 'provider.tf',
        content: `# Kubernetes Provider Configuration
terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
  }
}

provider "kubernetes" {
  config_path    = "./kubeconfig.yaml"
  config_context = "${kubeconfigInfo.context}"
}`,
        language: 'hcl',
        description: 'Kubernetes provider configuration'
      },
      {
        filename: 'variables.tf',
        content: `# Input Variables
variable "replicas" {
  description = "Number of Apache replicas"
  type        = number
  default     = ${replicas}
}

variable "namespace" {
  description = "Kubernetes namespace"
  type        = string
  default     = "${kubeconfigInfo.context}"
}

variable "app_name" {
  description = "Application name"
  type        = string
  default     = "apache-webserver"
}

variable "service_port" {
  description = "Service port"
  type        = number
  default     = ${servicePort}
}`,
        language: 'hcl',
        description: 'Input variables for the deployment'
      },
      {
        filename: 'main.tf',
        content: `# Apache Web Server Deployment
resource "kubernetes_deployment" "apache" {
  metadata {
    name      = var.app_name
    namespace = var.namespace
    labels = {
      app = var.app_name
    }
  }

  spec {
    replicas = var.replicas

    selector {
      match_labels = {
        app = var.app_name
      }
    }

    template {
      metadata {
        labels = {
          app = var.app_name
        }
      }

      spec {
        container {
          image = "httpd:2.4-alpine"
          name  = "apache"

          port {
            container_port = 80
            name           = "http"
          }

          resources {
            limits = {
              cpu    = "200m"
              memory = "256Mi"
            }
            requests = {
              cpu    = "100m"
              memory = "128Mi"
            }
          }

          liveness_probe {
            http_get {
              path = "/"
              port = 80
            }
            initial_delay_seconds = 30
            period_seconds        = 10
          }

          readiness_probe {
            http_get {
              path = "/"
              port = 80
            }
            initial_delay_seconds = 5
            period_seconds        = 5
          }
        }
      }
    }
  }
}

# Apache Service
resource "kubernetes_service" "apache" {
  metadata {
    name      = "\${var.app_name}-service"
    namespace = var.namespace
    labels = {
      app = var.app_name
    }
  }

  spec {
    selector = {
      app = var.app_name
    }

    port {
      port        = var.service_port
      target_port = 80
      protocol    = "TCP"
    }

    type = "NodePort"
  }
}`,
        language: 'hcl',
        description: 'Main Terraform resources for Apache deployment'
      },
      {
        filename: 'outputs.tf',
        content: `# Output Values
output "deployment_name" {
  description = "Name of the Apache deployment"
  value       = kubernetes_deployment.apache.metadata[0].name
}

output "service_name" {
  description = "Name of the Apache service"
  value       = kubernetes_service.apache.metadata[0].name
}

output "service_port" {
  description = "Port where Apache is accessible"
  value       = kubernetes_service.apache.spec[0].port[0].port
}

output "namespace" {
  description = "Namespace where resources are deployed"
  value       = var.namespace
}

output "replicas" {
  description = "Number of Apache replicas"
  value       = var.replicas
}`,
        language: 'hcl',
        description: 'Output values from the deployment'
      }
    ],
    summary: `Apache web server with ${replicas} replicas, accessible on port ${servicePort} via NodePort service`
  };
};

// Generate Nginx configuration
const generateNginxConfig = (kubeconfigInfo, prompt) => {
  const replicaMatch = prompt.match(/(\d+)\s*replica/i);
  const replicas = replicaMatch ? parseInt(replicaMatch[1]) : 2;
  const portMatch = prompt.match(/port\s*(\d+)/i);
  const servicePort = portMatch ? parseInt(portMatch[1]) : 30092;

  return {
    files: [
      {
        filename: 'provider.tf',
        content: `# Kubernetes Provider Configuration
terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
  }
}

provider "kubernetes" {
  config_path    = "./kubeconfig.yaml"
  config_context = "` + kubeconfigInfo.context + `"
}`,
        language: 'hcl',
        description: 'Kubernetes provider configuration'
      },
      {
        filename: 'main.tf',
        content: `# Nginx Web Server Deployment
resource "kubernetes_deployment" "nginx" {
  metadata {
    name      = "nginx-webserver"
    namespace = "` + kubeconfigInfo.context + `"
    labels = {
      app = "nginx-webserver"
    }
  }

  spec {
    replicas = ` + replicas + `

    selector {
      match_labels = {
        app = "nginx-webserver"
      }
    }

    template {
      metadata {
        labels = {
          app = "nginx-webserver"
        }
      }

      spec {
        container {
          image = "nginx:alpine"
          name  = "nginx"

          port {
            container_port = 80
            name           = "http"
          }

          resources {
            limits = {
              cpu    = "200m"
              memory = "256Mi"
            }
            requests = {
              cpu    = "100m"
              memory = "128Mi"
            }
          }

          liveness_probe {
            http_get {
              path = "/"
              port = 80
            }
            initial_delay_seconds = 30
            period_seconds        = 10
          }

          readiness_probe {
            http_get {
              path = "/"
              port = 80
            }
            initial_delay_seconds = 5
            period_seconds        = 5
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "nginx" {
  metadata {
    name      = "nginx-service"
    namespace = "` + kubeconfigInfo.context + `"
    labels = {
      app = "nginx-webserver"
    }
  }

  spec {
    selector = {
      app = "nginx-webserver"
    }

    port {
      port        = ` + servicePort + `
      target_port = 80
      protocol    = "TCP"
    }

    type = "NodePort"
  }
}`,
        language: 'hcl',
        description: 'Nginx deployment configuration'
      }
    ],
    summary: 'Nginx web server deployment'
  };
};

// Generate MySQL configuration
const generateMySQLConfig = (kubeconfigInfo, prompt) => {
  return {
    files: [
      {
        filename: 'provider.tf',
        content: `# Kubernetes Provider Configuration
terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
  }
}

provider "kubernetes" {
  config_path    = "./kubeconfig.yaml"
  config_context = "` + kubeconfigInfo.context + `"
}`,
        language: 'hcl',
        description: 'Kubernetes provider configuration'
      },
      {
        filename: 'main.tf',
        content: `# MySQL Database Deployment
resource "kubernetes_deployment" "mysql" {
  metadata {
    name      = "mysql-db"
    namespace = "` + kubeconfigInfo.context + `"
    labels = {
      app = "mysql-db"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "mysql-db"
      }
    }

    template {
      metadata {
        labels = {
          app = "mysql-db"
        }
      }

      spec {
        container {
          image = "mysql:8.0"
          name  = "mysql"

          port {
            container_port = 3306
            name           = "mysql"
          }

          env {
            name  = "MYSQL_ROOT_PASSWORD"
            value = "password"
          }

          env {
            name  = "MYSQL_DATABASE"
            value = "mydb"
          }

          resources {
            limits = {
              cpu    = "500m"
              memory = "512Mi"
            }
            requests = {
              cpu    = "200m"
              memory = "256Mi"
            }
          }

          liveness_probe {
            exec {
              command = ["mysqladmin", "ping", "-h", "localhost"]
            }
            initial_delay_seconds = 30
            period_seconds        = 10
          }

          readiness_probe {
            exec {
              command = ["mysqladmin", "ping", "-h", "localhost"]
            }
            initial_delay_seconds = 5
            period_seconds        = 5
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "mysql" {
  metadata {
    name      = "mysql-service"
    namespace = "` + kubeconfigInfo.context + `"
    labels = {
      app = "mysql-db"
    }
  }

  spec {
    selector = {
      app = "mysql-db"
    }

    port {
      port        = 3306
      target_port = 3306
      protocol    = "TCP"
    }

    type = "ClusterIP"
  }
}`,
        language: 'hcl',
        description: 'MySQL database deployment'
      }
    ],
    summary: 'MySQL database deployment'
  };
};

// Generate Redis configuration
const generateRedisConfig = (kubeconfigInfo, prompt) => {
  return {
    files: [
      {
        filename: 'provider.tf',
        content: `# Kubernetes Provider Configuration
terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
  }
}

provider "kubernetes" {
  config_path    = "./kubeconfig.yaml"
  config_context = "` + kubeconfigInfo.context + `"
}`,
        language: 'hcl',
        description: 'Kubernetes provider configuration'
      },
      {
        filename: 'main.tf',
        content: `# Redis Cache Deployment
resource "kubernetes_deployment" "redis" {
  metadata {
    name      = "redis-cache"
    namespace = "` + kubeconfigInfo.context + `"
    labels = {
      app = "redis-cache"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "redis-cache"
      }
    }

    template {
      metadata {
        labels = {
          app = "redis-cache"
        }
      }

      spec {
        container {
          image = "redis:alpine"
          name  = "redis"

          port {
            container_port = 6379
            name           = "redis"
          }

          resources {
            limits = {
              cpu    = "200m"
              memory = "256Mi"
            }
            requests = {
              cpu    = "100m"
              memory = "128Mi"
            }
          }

          liveness_probe {
            exec {
              command = ["redis-cli", "ping"]
            }
            initial_delay_seconds = 30
            period_seconds        = 10
          }

          readiness_probe {
            exec {
              command = ["redis-cli", "ping"]
            }
            initial_delay_seconds = 5
            period_seconds        = 5
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "redis" {
  metadata {
    name      = "redis-service"
    namespace = "` + kubeconfigInfo.context + `"
    labels = {
      app = "redis-cache"
    }
  }

  spec {
    selector = {
      app = "redis-cache"
    }

    port {
      port        = 6379
      target_port = 6379
      protocol    = "TCP"
    }

    type = "ClusterIP"
  }
}`,
        language: 'hcl',
        description: 'Redis cache deployment'
      }
    ],
    summary: 'Redis cache deployment'
  };
};

// API endpoint to generate infrastructure
app.post('/api/generate', async (req, res) => {
  try {
    const { prompt, projectName = 'terraform-project' } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const result = await generateInfrastructure(prompt);

    // Create project directory
    const projectDir = path.join(__dirname, 'projects', projectName);
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }

    // Save files to directory
    result.files.forEach(file => {
      const filePath = path.join(projectDir, file.filename);
      fs.writeFileSync(filePath, file.content);
    });

    // Copy kubeconfig to project directory
    const kubeconfigSrc = path.join(__dirname, 'kubeconfig.yaml');
    const kubeconfigDest = path.join(projectDir, 'kubeconfig.yaml');
    if (fs.existsSync(kubeconfigSrc)) {
      fs.copyFileSync(kubeconfigSrc, kubeconfigDest);
    }

    res.json({
      ...result,
      projectDir: projectDir,
      projectName: projectName
    });
  } catch (error) {
    console.error('Error generating infrastructure:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to run terraform commands
app.post('/api/terraform/:command', async (req, res) => {
  try {
    const { command } = req.params;
    const { projectName = 'terraform-project' } = req.body;

    const projectDir = path.join(__dirname, 'projects', projectName);

    if (!fs.existsSync(projectDir)) {
      return res.status(404).json({ error: 'Project directory not found' });
    }

    const validCommands = ['init', 'plan', 'apply', 'destroy'];
    if (!validCommands.includes(command)) {
      return res.status(400).json({ error: 'Invalid terraform command' });
    }

    // Check if Terraform is installed
    const terraformInstalled = await checkTerraformInstalled();
    if (!terraformInstalled) {
      const installationInstructions = {
        error: 'Terraform is not installed on the server',
        message: 'To use this application, Terraform must be installed on the server where this application is running.',
        installation: {
          linux: 'curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo apt-key add - && sudo apt-add-repository "deb [arch=amd64] https://apt.releases.hashicorp.com $(lsb_release -cs) main" && sudo apt-get update && sudo apt-get install terraform',
          macos: 'brew tap hashicorp/tap && brew install hashicorp/tap/terraform',
          windows: 'choco install terraform',
          manual: 'Download from https://www.terraform.io/downloads.html and add to PATH'
        },
        note: 'After installing Terraform, restart the application server.'
      };
      return res.status(500).json(installationInstructions);
    }

    const cmd = `cd ${projectDir} && terraform ${command} ${command === 'apply' ? '-auto-approve' : ''}`;

    exec(cmd, (error, stdout, stderr) => {
      const result = {
        command: cmd,
        success: !error,
        stdout: stdout,
        stderr: stderr,
        error: error ? error.message : null
      };

      if (error) {
        console.error(`Terraform ${command} error:`, error);
        return res.status(500).json(result);
      }

      res.json(result);
    });
  } catch (error) {
    console.error('Error running terraform command:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to check Terraform installation status
app.get('/api/terraform/status', async (req, res) => {
  try {
    const terraformInstalled = await checkTerraformInstalled();

    if (terraformInstalled) {
      exec('terraform version', (error, stdout, stderr) => {
        const version = stdout.split('\n')[0] || 'Unknown version';
        res.json({
          installed: true,
          version: version,
          message: 'Terraform is installed and ready to use'
        });
      });
    } else {
      res.json({
        installed: false,
        message: 'Terraform is not installed',
        installation: {
          linux: 'curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo apt-key add - && sudo apt-add-repository "deb [arch=amd64] https://apt.releases.hashicorp.com $(lsb_release -cs) main" && sudo apt-get update && sudo apt-get install terraform',
          macos: 'brew tap hashicorp/tap && brew install hashicorp/tap/terraform',
          windows: 'choco install terraform',
          manual: 'Download from https://www.terraform.io/downloads.html and add to PATH'
        }
      });
    }
  } catch (error) {
    console.error('Error checking Terraform status:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to get project files
app.get('/api/projects/:projectName/files', (req, res) => {
  try {
    const { projectName } = req.params;
    const projectDir = path.join(__dirname, 'projects', projectName);

    if (!fs.existsSync(projectDir)) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const files = fs.readdirSync(projectDir)
      .filter(file => file.endsWith('.tf') || file.endsWith('.yaml') || file.endsWith('.yml'))
      .map(filename => {
        const filePath = path.join(projectDir, filename);
        const content = fs.readFileSync(filePath, 'utf-8');
        return {
          filename,
          content,
          language: filename.endsWith('.tf') ? 'hcl' : 'yaml',
          description: `Terraform ${filename.endsWith('.tf') ? 'configuration' : 'config'} file`
        };
      });

    res.json({ files });
  } catch (error) {
    console.error('Error getting project files:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});