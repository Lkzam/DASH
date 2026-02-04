import Papa from 'papaparse';
import fs from 'node:fs';
import path from 'node:path';

export async function loadCSV(filename) {
  try {
    // Tenta diferentes caminhos possíveis
    const possiblePaths = [
      path.join(process.cwd(), 'public', 'data', filename),
      path.join(process.cwd(), 'data', filename),
      path.join(process.cwd(), 'src', 'data', filename),
    ];
    
    let filePath = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        filePath = p;
        break;
      }
    }
    
    if (!filePath) {
      console.error(`CSV file not found: ${filename}`);
      console.error('Tried paths:', possiblePaths);
      return [];
    }

    const csvData = fs.readFileSync(filePath, 'utf-8');
    
    return new Promise((resolve, reject) => {
      Papa.parse(csvData, {
        header: true,
        skipEmptyLines: true,
        delimiter: ';', // O CSV usa ponto e vírgula como separador
        transformHeader: (header) => header.trim(), // Remove espaços dos headers
        complete: (results) => {
          console.log(`CSV loaded: ${results.data.length} rows`);
          resolve(results.data);
        },
        error: (error) => {
          console.error('Error parsing CSV:', error);
          reject(error);
        }
      });
    });
  } catch (error) {
    console.error('Error loading CSV:', error);
    return [];
  }
}