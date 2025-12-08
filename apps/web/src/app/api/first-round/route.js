import { NextResponse } from "next/server";
import { loadCSV } from "../../../utils/csvLoader.js";

export async function GET() {
  const data = await loadCSV("Historico_Totalizacao_Presidente_BR_1T_2022.csv");
  return NextResponse.json(data);
}