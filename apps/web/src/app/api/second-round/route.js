import { loadCSV } from "../../../utils/csvLoader.js";

export async function GET() {
  try {
    const data = await loadCSV("Historico_Totalizacao_Presidente_BR_2T_2022.csv");
    
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error in second-round API:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}