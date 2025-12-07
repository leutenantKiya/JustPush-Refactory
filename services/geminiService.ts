import { GenerationResponse } from '../types';

const API_BASE_URL = 'http://localhost:9000/api';

export const generateInfrastructure = async (userPrompt: string, projectName?: string): Promise<GenerationResponse & { projectName: string }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: userPrompt,
        projectName: projectName || `project-${Date.now()}`
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to generate infrastructure');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
};

export const runTerraformCommand = async (command: 'init' | 'plan' | 'apply' | 'destroy', projectName: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/terraform/${command}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectName
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Failed to run terraform ${command}`);
    }

    return data;
  } catch (error) {
    console.error(`Terraform ${command} error:`, error);
    throw error;
  }
};

export const getProjectFiles = async (projectName: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/projects/${projectName}/files`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get project files');
    }

    const data = await response.json();
    return data.files;
  } catch (error) {
    console.error("Get project files error:", error);
    throw error;
  }
};