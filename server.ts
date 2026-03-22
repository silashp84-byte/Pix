import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import cors from 'cors';
import axios from 'axios';
import https from 'https';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// PIX API Client (Generic for Efí/Gerencianet style APIs)
class PixClient {
  private clientId: string;
  private clientSecret: string;
  private certificatePath: string;
  private apiUrl: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  private isPublic: boolean = false;

  constructor() {
    this.clientId = process.env.PIX_CLIENT_ID || '';
    this.clientSecret = process.env.PIX_CLIENT_SECRET || '';
    this.certificatePath = process.env.PIX_CERTIFICATE_PATH || '';
    this.apiUrl = process.env.PIX_API_URL || 'https://api-pix.gerencianet.com.br';
    this.isPublic = process.env.PIX_MODE === 'public';
  }

  getStatus() {
    return {
      mode: this.isPublic ? 'public' : 'private',
      configured: !!(this.clientId && this.clientSecret),
      usingCertificate: !!(this.certificatePath && fs.existsSync(this.certificatePath))
    };
  }

  private async getAccessToken() {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    if (!this.clientId || !this.clientSecret) {
      throw new Error('PIX_CLIENT_ID and PIX_CLIENT_SECRET are required.');
    }

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    
    // Most PIX APIs require a certificate for OAuth too
    const httpsAgent = this.certificatePath && fs.existsSync(this.certificatePath)
      ? new https.Agent({ pfx: fs.readFileSync(this.certificatePath), passphrase: '' })
      : undefined;

    try {
      const response = await axios.post(`${this.apiUrl}/oauth/token`, 
        { grant_type: 'client_credentials' },
        {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json'
          },
          httpsAgent
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000; // 1 min buffer
      return this.accessToken;
    } catch (error: any) {
      console.error('Error getting PIX access token:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with PIX API.');
    }
  }

  async sendPix(key: string, value: string) {
    // In a real scenario, this would call the /v2/pix endpoint for immediate transfers
    // or /v2/gn/pix/evp for keys.
    // Note: Different providers have different endpoints for "PIX Out".
    // This is a generic implementation for a PIX transfer.
    
    const token = await this.getAccessToken();
    const httpsAgent = this.certificatePath && fs.existsSync(this.certificatePath)
      ? new https.Agent({ pfx: fs.readFileSync(this.certificatePath), passphrase: '' })
      : undefined;

    try {
      // Example endpoint for Efí (Gerencianet) PIX Out
      const response = await axios.post(`${this.apiUrl}/v2/pix`, {
        valor: value,
        chave: key,
        // Other required fields like 'pagador' or 'infoPagador' would go here
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        httpsAgent
      });

      return response.data;
    } catch (error: any) {
      console.error('Error sending PIX:', error.response?.data || error.message);
      throw error.response?.data || new Error('Failed to send PIX.');
    }
  }
}

const pixClient = new PixClient();

// API Routes
app.get('/api/pix/status', (req, res) => {
  res.json(pixClient.getStatus());
});

app.post('/api/pix/transfer', async (req, res) => {
  const { key, value } = req.body;

  if (!key || !value) {
    return res.status(400).json({ error: 'Chave e valor são obrigatórios.' });
  }

  // Check if we have credentials, otherwise simulate for demo
  if (!process.env.PIX_CLIENT_ID || !process.env.PIX_CLIENT_SECRET) {
    console.log('Simulating PIX transfer (No credentials provided)');
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate delay
    return res.json({
      status: 'success',
      message: 'Transferência simulada com sucesso (Modo de Demonstração)',
      txid: 'simulated-' + Math.random().toString(36).substr(2, 9),
      valor: value,
      chave: key
    });
  }

  try {
    const result = await pixClient.sendPix(key, value);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erro ao processar transferência PIX.' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
