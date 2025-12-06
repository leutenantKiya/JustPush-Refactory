
import { Router } from 'express';
import { PluginEnvironment } from '../types';
import multer from 'multer';
import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';

const upload = multer({ storage: multer.memoryStorage() });

function analyzeDirectory(directory: string): string[] {
  let results: string[] = [];
  const items = fs.readdirSync(directory);
  for (const item of items) {
    const itemPath = path.join(directory, item);
    const stat = fs.statSync(itemPath);
    if (stat.isDirectory()) {
      results = results.concat(analyzeDirectory(itemPath));
    } else if (
      item === 'openapi.yaml' ||
      item === 'openapi.json' ||
      item === 'swagger.json'
    ) {
      results.push(itemPath);
    }
  }
  return results;
}

export default async function createPlugin(
  env: PluginEnvironment,
): Promise<Router> {
  const router = Router();

  router.get('/health', (_, response) => {
    response.json({ status: 'ok' });
  });

  router.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
      return res.status(400).send('No file uploaded.');
    }

    const tempDir = fs.mkdtempSync(path.join(env.cache.getPath('api-importer-'), 'temp-'));
    
    try {
      const zip = new AdmZip(req.file.buffer);
      zip.extractAllTo(tempDir, true);

      const apiFiles = analyzeDirectory(tempDir);

      return res.json({ files: apiFiles });
    } catch (e) {
      return res.status(500).send(`Error processing file: ${e}`);
    } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  return router;
}
