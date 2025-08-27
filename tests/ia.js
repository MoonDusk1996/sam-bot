import fs from "fs";

const chatLogs = fs.readFileSync(
  "/home/dusk/Trabalho (OneDrive)/Documentos/chamados/60006090678/chat.txt",
  "utf-8",
);

const TEMPLATE = `
[Responsável no acompanhamento]: 
[Problema relatado]: 
[Carga CMOS]: 
[Tensão AC]: 
[Bios Antiga]:  
[Bios nova]: 
[Inspeção visual]:
[Manutenção preventiva]:
[Monitor]: 
[Teclado]:
[Mouse]: 
[softwares de verificação utilizados]: 
[Solução]: 
[Observações]: 
[Chave do Windows]: 
`;

const prompt = `
Você vai analisar o seguinte chat e preencher as lacunas no template abaixo com base nesse chat.
O que não estiver relacionado pode deixar em branco, não precisa dizer que não foi especificado no chat aspenas deixe com um espaço vazio.

Novamente não especifique campos que você nao tem certeza, é muito importante deixa-los em branco.

Chat:
${chatLogs}

Template:
${TEMPLATE}
`;

const response = await fetch("http://localhost:11434/api/generate", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "gemma3n",
    prompt,
    stream: true, // agora vai vir em streaming
  }),
});

// o corpo da resposta é um ReadableStream
const reader = response.body.getReader();
const decoder = new TextDecoder("utf-8");

console.log("==== Relatório ====");

let buffer = "";
while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });

  // cada linha é um JSON separado (NDJSON)
  const lines = buffer.split("\n");
  buffer = lines.pop(); // guarda último pedaço incompleto

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line);
      if (parsed.response) {
        process.stdout.write(parsed.response); // imprime sem esperar o fim
      }
    } catch (err) {
      // se não for JSON válido ainda, ignora
    }
  }
}
