import ExcelJS from "exceljs";

const modelo = "modelo.xlsx";
const saida = "saida.xlsx";

async function preencherPlanilha() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(modelo);

  const sheet = workbook.getWorksheet(3);

  // Dados com número de colunas variável
  const dados = [
    ["000000000011179218", "TAMPA D N14LP6 COBALT GRAY", "8004026905", "", 1],
    [
      "000000000011190038",
      "ADAPT AC/DC PA-1650-90BB_5 EP 65W 3P LIT",
      12312,
      1,
    ],
    ["000000000011200000", "PEÇA TESTE"], // só 2 colunas
  ];

  let linha = 7;

  for (const rowData of dados) {
    const row = sheet.getRow(linha);

    rowData.forEach((valor, index) => {
      row.getCell(index + 1).value = valor; // index + 1 → colunas começam em 1
    });

    row.commit();
    linha++;
  }

  // ---- Ajustar largura das colunas automaticamente ----
  sheet.columns.forEach((col) => {
    let maxLength = 10; // largura mínima
    col.eachCell({ includeEmpty: true }, (cell) => {
      const value = cell.value ? cell.value.toString() : "";
      maxLength = Math.max(maxLength, value.length);
    });
    col.width = maxLength + 2; // margem extra
  });

  await workbook.xlsx.writeFile(saida);

  console.log("Planilha gerada:", saida);
}

preencherPlanilha().catch(console.error);
