
const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = 3000;
const DB_FILE = path.join(__dirname, "db.json");

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

function readDB() {
  let db = {};

  if (fs.existsSync(DB_FILE)) {
    try {
      db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    } catch (erro) {
      console.error("Erro ao ler banco de dados:", erro);
    }
  }

  db.usuarios = Array.isArray(db.usuarios) ? db.usuarios : [];
  db.pacientes = Array.isArray(db.pacientes) ? db.pacientes : [];
  db.triagens = Array.isArray(db.triagens) ? db.triagens : [];
  db.consultas = Array.isArray(db.consultas) ? db.consultas : [];
  db.medicacoes = Array.isArray(db.medicacoes) ? db.medicacoes : [];

  if (!db.tv || typeof db.tv !== "object") {
    db.tv = { chamada: null, historico: [] };
  }

  if (!Array.isArray(db.tv.historico)) {
    db.tv.historico = [];
  }

  return db;
}

function writeDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf8");
}

// PÁGINA INICIAL
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// CADASTRAR USUÁRIO
app.post("/usuarios", (req, res) => {
  try {
    const { usuario, senha, tipo, nome } = req.body;

    if (!usuario || !senha || !tipo) {
      return res.status(400).json({
        erro: "Preencha usuário, senha e tipo."
      });
    }

    const db = readDB();

    if (db.usuarios.some(u => u.usuario === usuario)) {
      return res.status(409).json({
        erro: "Usuário já cadastrado."
      });
    }

    db.usuarios.push({
      id: Date.now(),
      nome: nome || usuario,
      usuario: String(usuario).trim(),
      senha: String(senha),
      tipo: String(tipo).trim().toLowerCase()
    });

    writeDB(db);

    res.status(201).json({
      mensagem: "Usuário cadastrado com sucesso."
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Erro ao cadastrar usuário." });
  }
});

// LISTAR USUÁRIOS SEM SENHAS
app.get("/usuarios", (req, res) => {
  const db = readDB();

  res.json(db.usuarios.map(({ senha, ...usuario }) => usuario));
});

// LOGIN
app.post("/login", (req, res) => {
  const { usuario, senha } = req.body;
  const db = readDB();

  const encontrado = db.usuarios.find(
    u => u.usuario === usuario && u.senha === senha
  );

  if (!encontrado) {
    return res.status(401).json({
      erro: "Usuário ou senha incorretos."
    });
  }

  res.json({
    mensagem: "Login realizado com sucesso.",
    tipo: encontrado.tipo,
    usuario: encontrado.usuario,
    nome: encontrado.nome
  });
});

// CADASTRAR PACIENTE
app.post("/atendimento", (req, res) => {
  try {
    const { nome, cpf, dataNascimento, telefone, motivo } = req.body;

    if (!nome || !String(nome).trim()) {
      return res.status(400).json({
        erro: "Informe o nome do paciente."
      });
    }

    const db = readDB();

    const paciente = {
      id: Date.now(),
      nome: String(nome).trim(),
      cpf: cpf || "",
      dataNascimento: dataNascimento || "",
      telefone: telefone || "",
      motivo: motivo || "",
      status: "triagem",
      criadoEm: new Date().toISOString()
    };

    db.pacientes.push(paciente);
    writeDB(db);

    res.status(201).json({
      mensagem: "Paciente cadastrado com sucesso.",
      paciente
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Erro ao cadastrar paciente." });
  }
});

// LISTAR PACIENTES
app.get("/pacientes", (req, res) => {
  const db = readDB();
  res.json(db.pacientes);
});

// REGISTRAR TRIAGEM
app.post("/triagem", (req, res) => {
  try {
    const {
      pacienteId,
      nome,
      cpf,
      temperatura,
      pressao,
      sintomas,
      prioridade
    } = req.body;

    if (!nome || !String(nome).trim()) {
      return res.status(400).json({
        erro: "Informe o nome do paciente."
      });
    }

    const db = readDB();

    const triagem = {
      id: Date.now(),
      pacienteId: pacienteId || null,
      nome: String(nome).trim(),
      cpf: cpf || "",
      temperatura: temperatura || "",
      pressao: pressao || "",
      sintomas: sintomas || "",
      prioridade: prioridade || "Normal",
      status: "aguardando_medico",
      criadoEm: new Date().toISOString()
    };

    db.triagens.push(triagem);

    if (pacienteId) {
      const paciente = db.pacientes.find(
        p => String(p.id) === String(pacienteId)
      );

      if (paciente) {
        paciente.status = "aguardando_medico";
      }
    }

    writeDB(db);

    res.status(201).json({
      mensagem: "Triagem registrada com sucesso.",
      triagem
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Erro ao registrar triagem." });
  }
});

// LISTAR TRIAGENS
app.get("/triagens", (req, res) => {
  const db = readDB();
  res.json(db.triagens);
});


 // CHAMAR PACIENTE NA TV
app.post("/tv/chamar", (req, res) => {
  try {
    const { paciente, localTipo, localNumero } = req.body;

    if (!paciente || !String(paciente).trim()) {
      return res.status(400).json({
        erro: "Informe o nome do paciente."
      });
    }

    const db = readDB();

    // Garantir que a estrutura da TV exista
    if (!db.tv || typeof db.tv !== "object") {
      db.tv = {
        chamada: null,
        historico: []
      };
    }

    if (!Array.isArray(db.tv.historico)) {
      db.tv.historico = [];
    }

    const chamada = {
      id: Date.now(),
      paciente: String(paciente).trim(),
      localTipo: String(localTipo || "CONSULTÓRIO").trim(),
      localNumero: String(localNumero || "01").trim(),
      data: new Date().toISOString()
    };

    // Salvar chamada atual e histórico
    db.tv.chamada = chamada;
    db.tv.historico.unshift(chamada);
    db.tv.historico = db.tv.historico.slice(0, 20);

    writeDB(db);

    return res.status(201).json({
      sucesso: true,
      mensagem: "Paciente chamado na TV com sucesso!",
      chamada
    });

  } catch (erro) {
    console.error("Erro na rota /tv/chamar:", erro);

    return res.status(500).json({
      erro: "Erro ao chamar paciente na TV.",
      detalhes: erro.message
    });
  }
});

// CONSULTAR CHAMADA ATUAL E HISTÓRICO
app.get("/tv/chamada", (req, res) => {
  try {
    const db = readDB();

    return res.json({
      chamada: db.tv?.chamada || null,
      historico: db.tv?.historico || []
    });

  } catch (erro) {
    console.error("Erro na rota /tv/chamada:", erro);

    return res.status(500).json({
      erro: "Não foi possível carregar as chamadas da TV."
    });
  }
});


// REGISTRAR CONSULTA
app.post("/consulta", (req, res) => {
  try {
    const db = readDB();

    const consulta = {
      id: Date.now(),
      ...req.body,
      criadoEm: new Date().toISOString()
    };

    db.consultas.push(consulta);
    writeDB(db);

    res.status(201).json({
      mensagem: "Consulta registrada.",
      consulta
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Erro ao registrar consulta." });
  }
});

// LISTAR MEDICAÇÕES
app.get("/medicacoes", (req, res) => {
  const db = readDB();
  res.json(db.medicacoes);
});

app.get("/lista-medicacoes", (req, res) => {
  const db = readDB();
  res.json(db.medicacoes);
});

// INICIAR SERVIDOR
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
