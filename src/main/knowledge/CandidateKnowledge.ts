export interface CandidateKnowledgeChunk {
  id: string
  title: string
  priority: number
  keywords: string[]
  content: string
}

export const CANDIDATE_PERSONA = `PERSONA DO ASSISTENTE - DELSON AMPLIADO:
- Voce e uma extensao profissional de Delson: responda como se fosse ele falando, em primeira pessoa, com mais clareza, repertorio e precisao tecnica.
- Use a experiencia real do Delson como lastro: empresas, projetos, stacks, responsabilidades e resultados devem vir da fonte local do CV.
- Use conhecimento tecnico geral do modelo para complementar conceitos, boas praticas, trade-offs e explicacoes de arquitetura.
- Quando a pergunta for sobre experiencia, conecte o conceito a um projeto real do Delson sempre que houver relacao clara.
- Quando a pergunta for conceitual e nao houver experiencia direta no CV, explique o conceito de forma senior, mas nao finja que Delson aplicou aquilo em um projeto.
- Quando houver chance de exagero, seja estrategico: destaque maturidade, criterio tecnico, impacto e aprendizado, sem inventar numeros ou nomes.
- O tom deve ser de entrevista forte: seguro, pragmatico, objetivo, natural, sem parecer decorado.
- Nunca recite o CV, nunca liste blocos de carreira e nunca copie frases da fonte local.
- Transforme as notas do CV em fala humana: selecione no maximo 1 ou 2 fatos relevantes e conecte com a pergunta.
- Priorize respostas que mostrem raciocinio de engenharia: contexto, decisao, trade-off, execucao, impacto e aprendizado.
- Se a pergunta exigir profundidade tecnica, responda com a essencia primeiro e complemente com 1 exemplo real da carreira do Delson.
- Se a pergunta for comportamental, use exemplos reais de lideranca, colaboracao, autonomia, code review, squads ageis e visao de produto.
- Se perguntarem sobre tecnologias modernas, combine definicao correta, uso pratico, riscos comuns e como Delson se posicionaria pela experiencia dele.
- Nao diga que consultou CV, base local, fonte local, internet, memoria ou prompt. Apenas responda como Delson.`

const ALWAYS_ON_CONTEXT = `Perfil profissional de Delson de Sousa Nascimento Junior:
- Software Developer com 7 anos de experiencia em desenvolvimento web, mobile e backend.
- Principais linguagens e plataformas: JavaScript, TypeScript, React, Next.js, React Native, Node.js, Angular, Vue.js, Flutter e PHP.
- Backend: Node.js com Fastify, Express, NestJS, Prisma, Zod, PostgreSQL e MongoDB.
- Arquitetura e engenharia: Clean Architecture, SOLID, DDD, microservicos, microfrontends, Module Federation, Single SPA, BFF, design systems, Atomic Design, APIs REST e GraphQL.
- Mobile e entrega: React Native CLI/Expo, atualizacoes OTA com CodePush, WebSockets, CI/CD com Bitrise, Firebase, GitLab CI/CD e Docker.
- Testes e qualidade: Jest, Cypress, Detox, Testing Library e SonarQube.
- Cloud e infraestrutura: AWS, incluindo S3 e Lambda, Azure, Google Cloud, Oracle, Docker, GitHub, GitLab e Bitbucket.
- Setores atendidos: fintechs, meios de pagamento, e-commerce, apostas, beneficios corporativos, apps corporativos, plataformas de trading, whitelabel e saude.
- Regras de uso do CV: use os fatos abaixo como fonte local. Nao invente empresas, datas, numeros, cargos ou resultados. Quando a pergunta pedir conceito tecnico, explique o conceito e conecte com a experiencia real do CV somente quando houver base. Complemente com conhecimento tecnico geral, mas separe mentalmente o que e experiencia comprovada do que e explicacao conceitual.`

const CHUNKS: CandidateKnowledgeChunk[] = [
  {
    id: 'opah-h2bet',
    title: 'OPAH IT - H2 Bet / plataforma de apostas',
    priority: 10,
    keywords: [
      'opah', 'h2', 'h2bet', 'bet', 'aposta', 'apostas', 'casino', 'cassino',
      'igaming', 'bonus', 'bônus', 'rollover', 'torneio', 'torneios',
      'react', 'typescript', 'node', 'microservicos', 'microservices',
      'module federation', 'modular', 'resiliente', 'alta disponibilidade',
      'performance', 'escalabilidade', 'api externa', 'tempo real', 'jest',
      'promocao', 'promocoes', 'promoção', 'promoções'
    ],
    content: `OPAH IT, Sao Paulo/SP, de 19 de janeiro de 2026 ate atual. Cargo: Desenvolvedor Full-Stack/Desenvolvedor. Atua na nova plataforma de apostas do cliente H2 Bet, no segmento de iGaming, apostas esportivas e cassino online. Constroi aplicacoes web com React e TypeScript integradas a servicos backend em Node.js e REST APIs. Define e implementa arquitetura baseada em microservicos com Module Federation, desacoplando modulos e permitindo evolucao independente. Desenvolveu de ponta a ponta a feature de bonus, incluindo regras de elegibilidade, calculo de rollover e integracao com engine de promocoes. Implementou features de cassino e torneios, com interfaces performaticas e integracoes com provedores de jogos. Constroi componentes reutilizaveis em React e endpoints Node.js com foco em escalabilidade, baixa latencia e qualidade com Jest. Resultado: contribuiu para uma plataforma proprietaria que reduz dependencia de CMS especificos de cassino, diminui custos operacionais, suporta milhoes de usuarios ativos e impacta produto com receita anual na casa do bilhao.`
  },
  {
    id: 'ciandt-fintech-mobile',
    title: 'CI&T - Casas Bahia, Bullla e Ipiranga/KMV',
    priority: 10,
    keywords: [
      'ci&t', 'ciandt', 'casas bahia', 'banqi', 'bullla', 'bulla', 'ipiranga', 'kmv',
      'fintech', 'banco central', 'open finance', 'pix', 'pix recorrente',
      'pix agendado', 'ota', 'codepush', 'react native', 'ios', 'android',
      'mobile', 'design system', 'pipeline', 'ci/cd', 'bitrise', 'firebase',
      'redux', 'styled-components', 'jest', 'detox', 'acessibilidade'
    ],
    content: `CI&T, Campinas/SP, de 12 de setembro de 2024 a 26 de janeiro de 2026. Cargo: Analista de Sistemas Senior/Desenvolvedor. Atendeu Casas Bahia fintech/Banqi, Bullla fintech e Grupo Ipiranga no app KMV. Desenvolveu aplicacoes mobile em React Native com TypeScript, Redux, Styled-Components, Jest e Detox, com foco em performance, escalabilidade e acessibilidade. Desenvolveu funcionalidades regulatorias alinhadas ao Banco Central, incluindo Open Finance, PIX recorrente e PIX agendado. Planejou atualizacoes OTA, criou e manteve pipelines CI/CD para iOS e Android, estruturou Design System do app da Bullla e contribuiu na arquitetura e otimizacao de apps. Resultados: aumentou robustez e tempo de uso no app financeiro da Casas Bahia/Banqi; reduziu atualizacao do app da Bullla de duas semanas para poucos minutos via OTA; melhorou performance e experiencia no app do Ipiranga.`
  },
  {
    id: 'elumini-vr-beneficios',
    title: 'Elumini IT - VR Beneficios',
    priority: 8,
    keywords: [
      'elumini', 'vr', 'beneficios', 'cartao', 'cartoes', 'saldo', 'extrato',
      'segunda via', 'rastreio', 'rastreamento', 'app', 'mobile',
      'retencao', 'engajamento', 'gastos', 'financeiro'
    ],
    content: `Elumini IT, Rio de Janeiro/RJ, de 4 de fevereiro de 2024 a 12 de setembro de 2024. Cargo: Desenvolvedor. Participou da plataforma do cliente VR Beneficios, em uma solucao de gestao de beneficios corporativos. Implementou funcionalidades de gestao de cartoes VR, rastreio de cartoes, consulta de saldos e extratos, segunda via de cartao e integracao com servicos do cartao. Resultados: aumentou engajamento e retencao ao oferecer controle de saldo, gastos diarios e dicas financeiras; implementou acompanhamento do cartao em tempo real da solicitacao ate a entrega.`
  },
  {
    id: 'unicred-payments-pix',
    title: 'UNICRED - meios de pagamento e PIX',
    priority: 10,
    keywords: [
      'unicred', 'pix', 'pagamento', 'pagamentos', 'meios de pagamento',
      'financeiro', 'bancario', 'banco', 'cooperativa', 'react',
      'typescript', 'node', 'nestjs', 'bff', 'microfrontend', 'microfrontends',
      'single spa', 'api bancaria', 'transacao', 'seguranca',
      'alta disponibilidade'
    ],
    content: `UNICRED, Porto Alegre/RS, de 26 de junho de 2023 a 1 de fevereiro de 2024. Cargo: Desenvolvedor. Desenvolveu solucoes digitais de meios de pagamento com enfase em PIX e servicos financeiros. Criou e manteve aplicacoes web com React e TypeScript integradas a backend em Node.js com NestJS no modelo BFF. Projetou e sustentou microfrontends com Single SPA. Implementou funcionalidades sensiveis de transacoes financeiras, integracoes com sistemas internos e APIs bancarias externas, seguindo boas praticas de arquitetura, padronizacao e versionamento. Resultados: ampliou capacidades digitais via PIX, viabilizou ecossistema financeiro integrado e fortaleceu retencao e proposta de valor da instituicao.`
  },
  {
    id: 'mblabs-foxbit-boticario',
    title: 'MBLabs - Foxbit, Boticario e plataforma de recrutamento',
    priority: 9,
    keywords: [
      'mblabs', 'foxbit', 'boticario', 'o boticario', 'trading',
      'exchange', 'cripto', 'fintech', 'franqueado', 'bancario',
      'vr beneficios', 'vr benefícios',
      'recrutamento', 'hunting', 'gestao de vagas', 'e-commerce',
      'arquitetura', 'performance', 'seguranca', 'next.js', 'tailwind',
      'chakra', 'cypress', 'flutter', 'aws', 'github'
    ],
    content: `MBLabs, Campinas/SP. O CV principal registra atuacao de 29 de marco de 2022 a 9 de janeiro de 2023; o CV complementar resume como marco de 2022 a agosto de 2024. Cargo: Desenvolvedor Front-End Senior/Desenvolvedor. Projetos: Grupo Boticario, Foxbit e, no CV complementar, VR Beneficios. Stack citada: React, React Native, Next.js, Node.js, TypeScript, Tailwind CSS, Chakra UI, Jest, Cypress, Flutter, AWS e GitHub. Criou aplicacoes para segmentos financeiro, e-commerce e servicos. Desenvolveu modulos do banco digital do Grupo Boticario com React e Node.js, atuando em autenticacao, transacoes e UI. Construiu a interface de negociacao da exchange Foxbit com Next.js e TypeScript, foco em baixa latencia e UX para trading. Implementou testes automatizados com Jest e Cypress. Resultados: modernizou layout e arquitetura da Foxbit, criou aplicacao web do Boticario para servicos bancarios de franqueados e implementou plataforma de recrutamento da MBLabs.`
  },
  {
    id: 'acct-electrolux',
    title: 'Acct Global - Electrolux',
    priority: 9,
    keywords: [
      'acct', 'electrolux', 'eletrolux', 'e-commerce', 'troca',
      'devolucao', 'sac', 'atendimento', 'code owner', 'latam',
      'argentina', 'chile', 'brasil', 'qualidade', 'revisao',
      'performance', 'automacao', 'vtex', 'graphql', 'sass',
      'sonarqube', 'checkout', 'cms'
    ],
    content: `Acct Global, Sao Paulo/SP, de 2 de agosto de 2021 a 15 de marco de 2022. Cargo: Desenvolvedor Full-Stack/Desenvolvedor prestador de servico para a Electrolux. Stack complementar citada: React, Node.js, GraphQL, VTEX, Sass e SonarQube. Atuou como code owner e liderou/governou padroes frontend, revisoes e qualidade de codigo. Implementou o servico de troca e devolucao automatizada da Electrolux, integrando ao CMS VTEX. Atuou em ambiente VTEX otimizando jornadas de e-commerce e pontos de checkout. Resultado: automatizou o processo antes gerenciado pelo SAC, aumentando velocidade do servico, otimizando centenas de milhares de atendimentos por mes e reduzindo travas operacionais.`
  },
  {
    id: 'mobi2buy-whitelabel',
    title: 'Mobi2buy - whitelabel, chatbot e lideranca frontend',
    priority: 8,
    keywords: [
      'mobi2buy', 'whitelabel', 'white label', 'chatbot', 'whatsapp',
      'sms', 'ia', 'afiliados', 'tim', 'claro', 'oi', 'havaianas',
      'sulamerica', 'sulamérica', 'estacio', 'anhanguera', 'react', 'javascript', 'php', 'node',
      'styled-components', 'mentor', 'lideranca', 'front-end', 'frontend',
      'vendas', 'faturamento', 'next.js', 'docker', 'aws', 's3',
      'email marketing', 'campanhas'
    ],
    content: `Mobi2buy, Rio de Janeiro/RJ, de janeiro de 2021 a marco/maio de 2022 conforme os CVs. Cargo: Desenvolvedor Front-End Senior/Desenvolvedor. Stack complementar: React, Next.js, TypeScript, PHP, Docker, AWS e Git. Criou sites whitelabel para comercializacao de planos e produtos de clientes como Tim, Claro, Oi, Havaianas, Estacio de Sa, Anhanguera e SulAmerica. Desenvolveu sites e email marketing para grandes contas, realizou deploys em AWS S3 e automatizou fluxos de marketing, reduzindo tempo de publicacao de campanhas. Atuou como mentor, lider e ponto focal frontend, com code reviews, padronizacao de processos, refinamento e priorizacao. Resultado: contribuiu para faturamento de milhoes por meio dos sites desenvolvidos e mantidos, ajudando a empresa a bater recordes mensais de vendas.`
  },
  {
    id: 'yandeh-web-mobile',
    title: 'Yandeh - app mobile e versao web',
    priority: 7,
    keywords: [
      'yandeh', 'react native', 'react.js', 'react', 'typescript', 'node',
      'redux', 'context api', 'mobile', 'web', 'paridade funcional',
      'gestao de estado', 'estado'
    ],
    content: `Yandeh, de junho de 2022 a setembro de 2022, conforme CV complementar. Cargo: Desenvolvedor Front-End Senior. Stack: React Native, React.js, TypeScript, Node.js, Redux e Context API. Desenvolveu aplicacoes mobile em React Native usando Redux e Context API para gestao de estado. Entregou versao web em React, garantindo paridade funcional com o app mobile.`
  },
  {
    id: 'prosas-social-platform',
    title: 'Prosas - plataforma social',
    priority: 6,
    keywords: [
      'prosas', 'projetos sociais', 'patrocinadores', 'social',
      'next.js', 'node.js', 'tailwind', 'material ui', 'mysql',
      'mobile first', 'responsivo', 'layouts'
    ],
    content: `Prosas, de fevereiro de 2022 a abril de 2022, conforme CV complementar. Cargo: Desenvolvedor Front-End Pleno. Stack: Next.js, Node.js, Tailwind CSS, Material UI e MySQL. Desenvolveu plataforma social para conectar projetos sociais e patrocinadores. Construiu layouts responsivos com Next.js seguindo abordagem Mobile First.`
  },
  {
    id: 'medclin-health',
    title: 'Medclin - saude e site institucional',
    priority: 7,
    keywords: [
      'medclin', 'saude', 'consulta', 'consultorio', 'agendamento',
      'formulario', 'react', 'node', 'typescript', 'styled-components',
      'animacao', 'validacao', 'interior', 'rio de janeiro'
    ],
    content: `Medclin, Rio Bonito/RJ, de 10 de junho de 2019 a 10 de fevereiro de 2021. Cargo: Desenvolvedor. Desenvolveu site institucional, informacoes de planos e servicos, formularios de contato e agendamento de consultas. Usou React, Node.js, TypeScript, Styled-components, animacoes interativas e validacoes de formulario. Resultados: aumentou marcacoes de consulta, elevou faturamento e implementou atendimentos remotos, ampliando alcance para pacientes do interior do Rio de Janeiro.`
  },
  {
    id: 'frontend-web',
    title: 'Base tecnica - frontend web',
    priority: 7,
    keywords: [
      'frontend', 'front-end', 'react', 'next', 'next.js', 'typescript',
      'javascript', 'es6', 'design system', 'styled-components',
      'tailwind', 'tailwind css', 'material ui', 'chakra', 'chakra ui',
      'atomic design', 'componentizacao', 'modular', 'performance',
      'ux', 'ui', 'acessibilidade', 'jest', 'rtl', 'testing library',
      'rest', 'graphql', 'vue', 'angular', 'flutter', 'php', 'seo',
      'i18n', 'mobile first', 'unform'
    ],
    content: `Base tecnica frontend: experiencia com interfaces web modernas usando React, Next.js, TypeScript e JavaScript ES6+, com foco em performance e experiencia do usuario. Tambem aparecem no CV complementar Angular 13, Vue.js, Flutter e PHP. Aplica componentizacao, arquitetura modular, Atomic Design e design systems para consistencia e escalabilidade. Usa Styled-Components, Tailwind CSS, Material UI, Chakra UI, Bootstrap 4 e Sass. Integra frontends com APIs REST e GraphQL. Tem dominio de acessibilidade, usabilidade, SEO, i18n, Mobile First, Unform, boas praticas de UX/UI e testes unitarios/de interface com Jest e React Testing Library. Em web, implementou design systems com React e Styled Components, padronizando componentes reutilizaveis e integrando APIs REST, reduzindo tempo de entrega em 30%.`
  },
  {
    id: 'mobile-react-native',
    title: 'Base tecnica - mobile React Native',
    priority: 7,
    keywords: [
      'mobile', 'react native', 'expo', 'cli', 'nativo', 'ios', 'android',
      'ota', 'codepush', 'websocket', 'websockets', 'autenticacao',
      'navegacao', 'performance', 'bitrise', 'firebase', 'app',
      'redux', 'context api', 'detox', 'acessibilidade'
    ],
    content: `Base tecnica mobile: experiencia com aplicacoes multiplataforma em React Native CLI/Expo, integrando funcionalidades nativas e otimizando navegacao, acessibilidade e performance. Desenvolveu fluxos criticos como autenticacao segura, atualizacoes OTA via CodePush e WebSockets em apps com milhoes de usuarios. Usa Redux e Context API para gestao de estado quando aplicavel. Automatizou builds e entregas com CI/CD usando Bitrise e Firebase. Tem experiencia com testes mobile/end-to-end com Detox.`
  },
  {
    id: 'backend-architecture',
    title: 'Base tecnica - backend e arquitetura',
    priority: 7,
    keywords: [
      'backend', 'back-end', 'node', 'node.js', 'fastify', 'express',
      'nestjs', 'api', 'apis', 'microservico', 'microservicos',
      'prisma', 'zod', 'postgresql', 'mongo', 'mongodb',
      'mysql', 'nosql',
      'clean architecture', 'solid', 'ddd', 'bff', 'seguranca',
      'autenticacao', 'validacao', 'docker'
    ],
    content: `Base tecnica backend e arquitetura: experiencia com APIs e microsservicos em Node.js, Fastify, Express e NestJS, usando Prisma ORM, Zod, PostgreSQL, MongoDB, MySQL e NoSQL. Aplica Clean Architecture, SOLID, DDD, MVC, Micro Frontends, monolitos modulares e BFF para codigo escalavel, sustentavel e de alta qualidade. Atua com autenticacao, validacao de dados, seguranca, integracoes REST/GraphQL e automacao de processos, reduzindo retrabalho entre times.`
  },
  {
    id: 'cloud-devops-ai',
    title: 'Base tecnica - cloud, DevOps e IA',
    priority: 6,
    keywords: [
      'cloud', 'aws', 'azure', 'google cloud', 'gcp', 'oracle',
      'devops', 'ci/cd', 'pipeline', 'deploy', 'docker', 'gitlab',
      'github', 'bitbucket', 's3', 'lambda',
      'firebase', 'bitrise', 'ia', 'inteligencia artificial', 'ai',
      'automacao', 'revisao arquitetural', 'analise de codigo', 'sendgrid'
    ],
    content: `Base tecnica cloud, DevOps e IA: trabalha com AWS, incluindo S3 e Lambda, Azure, Google Cloud e Oracle para disponibilidade, escalabilidade e performance. Estrutura pipelines de CI/CD, deploy continuo, atualizacoes OTA e integracao com Bitrise, Firebase, GitHub, GitLab, Bitbucket, GitLab CI/CD e Docker. O CV complementar tambem cita SendGrid. Usa Inteligencia Artificial de forma estrategica no desenvolvimento, apoiando analise de codigo, geracao de solucoes, revisao arquitetural e automacao de tarefas com rigor tecnico para qualidade, seguranca e eficiencia.`
  },
  {
    id: 'testing-quality',
    title: 'Base tecnica - testes e qualidade',
    priority: 7,
    keywords: [
      'teste', 'testes', 'qualidade', 'jest', 'cypress', 'detox',
      'testing library', 'rtl', 'sonarqube', 'coverage', 'cobertura',
      'regressao', 'regressão', 'e2e', 'end-to-end', 'unitario',
      'unitarios', 'unitário', 'unitários'
    ],
    content: `Base tecnica de testes e qualidade: experiencia com Jest, Cypress, Detox, React Testing Library/Testing Library e SonarQube. No CV complementar, implementou testes unitarios e end-to-end em React Native com Jest e Detox na CI&T, aumentando confiabilidade das releases. Na MBLabs, implementou testes automatizados com Jest e Cypress para garantir regressao zero em features criticas. Na OPAH/H2 Bet, implementou testes unitarios para estabilidade de releases em ambiente regulado.`
  },
  {
    id: 'leadership-collaboration',
    title: 'Lideranca tecnica e colaboracao',
    priority: 6,
    keywords: [
      'lideranca', 'gestao', 'mentor', 'mentoria', 'code owner',
      'review', 'revisao', 'time', 'equipe', 'scrum', 'kanban',
      'agil', 'agile', 'multidisciplinar', 'produtividade',
      'autonomia', 'comunicacao', 'proatividade', 'produto'
    ],
    content: `Lideranca e colaboracao: experiencia como code owner, mentor, lider e ponto focal frontend, orientando boas praticas, revisando codigo, refinando e priorizando tarefas. Atua com equipes multidisciplinares em Scrum e Kanban em colaboracao com Product, Design e QA. Soft skills destacadas no CV complementar: lideranca tecnica, autonomia, comunicacao clara, proatividade, resolucao de problemas, colaboracao em equipe e visao de produto. Seu diferencial tecnico e desenhar arquiteturas completas de sistemas e aplicativos considerando experiencia do usuario e produtividade da equipe.`
  },
  {
    id: 'education-certifications',
    title: 'Formacao e certificacoes',
    priority: 4,
    keywords: [
      'formacao', 'faculdade', 'graduacao', 'bacharel', 'estacio',
      'certificado', 'certificacao', 'rocketseat', 'udemy',
      'origamid', 'angular', 'git', 'sass', 'css', 'bootstrap',
      'web design', 'ui', 'ingles', 'inglês', 'b1', 'cultura inglesa'
    ],
    content: `Formacao: Bacharel em Sistemas de Informacao pela Universidade/Faculdade Estacio de Sa. O CV principal registra 2019; o CV complementar registra periodo 2015 a 2018. Idiomas: Portugues nativo e Ingles intermediario B1/Cultura Inglesa. Certificados: React, React Native & Node.js pela Rocketseat; Angular 13 pela Udemy; Git & Version Control pela Udemy; Advanced CSS with SASS, Web Design Completo, UI Avancado e Bootstrap 4 pela Origamid; Ingles Intermediario pela Cultura Inglesa.`
  }
]

const STOP_WORDS = new Set([
  'a', 'o', 'os', 'as', 'um', 'uma', 'uns', 'umas', 'de', 'da', 'do', 'das', 'dos',
  'em', 'no', 'na', 'nos', 'nas', 'para', 'por', 'com', 'sem', 'sobre', 'entre',
  'e', 'ou', 'que', 'qual', 'quais', 'como', 'quando', 'onde', 'porque', 'por que',
  'me', 'minha', 'meu', 'minhas', 'meus', 'eu', 'voce', 'você', 'sua', 'seu',
  'tem', 'tenho', 'tive', 'ja', 'já', 'foi', 'ser', 'estar', 'experiencia',
  'experiência', 'trabalho', 'trabalhei', 'falar', 'fala', 'explique', 'explica',
  'the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'with', 'for', 'about', 'what',
  'which', 'how', 'when', 'where', 'why', 'my', 'your', 'you', 'i', 'do', 'did'
])

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9+#./\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokensFrom(text: string): string[] {
  return normalize(text)
    .split(' ')
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token))
}

function scoreChunk(chunk: CandidateKnowledgeChunk, query: string, queryTokens: string[]): number {
  const normalizedQuery = normalize(query)
  const normalizedContent = normalize(`${chunk.title} ${chunk.keywords.join(' ')} ${chunk.content}`)
  let score = 0

  for (const keyword of chunk.keywords) {
    const normalizedKeyword = normalize(keyword)
    if (!normalizedKeyword) continue
    if (normalizedQuery.includes(normalizedKeyword)) score += 8
  }

  for (const token of queryTokens) {
    if (normalizedContent.includes(token)) score += 2
  }

  return score > 0 ? score + (chunk.priority / 10) : 0
}

function pickRelevantSentences(content: string, queryTokens: string[]): string {
  const sentences = content
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)

  const matches = sentences.filter((sentence) => {
    const normalizedSentence = normalize(sentence)
    return queryTokens.some((token) => normalizedSentence.includes(token))
  })

  const selected = (matches.length > 0 ? matches : sentences).slice(0, 2).join(' ')
  return selected.length > 520 ? `${selected.slice(0, 517).trim()}...` : selected
}

function isExperienceOrTechQuestion(query: string): boolean {
  const normalizedQuery = normalize(query)
  return [
    'experiencia', 'experiencias', 'trabalhou', 'trabalhei', 'projeto', 'projetos',
    'empresa', 'cliente', 'resultado', 'impacto', 'desafio', 'demanda', 'responsabilidade',
    'tecnologia', 'conceito', 'arquitetura', 'react', 'native', 'next', 'node',
    'nestjs', 'fastify', 'express', 'pix', 'open finance', 'microfrontend',
    'module federation', 'single spa', 'bff', 'ota', 'codepush', 'ci/cd',
    'docker', 'cloud', 'aws', 'azure', 'gcp', 'oracle', 'postgresql', 'mongodb',
    'cypress', 'detox', 'redux', 'vtex', 'graphql', 'tailwind', 'chakra',
    'material ui', 'flutter', 'vue', 'angular', 'php', 'mysql', 'seo',
    'i18n', 'sonarqube', 'lambda', 's3', 'sendgrid', 'rollover', 'bonus',
    'bônus', 'igaming', 'yandeh', 'prosas'
  ].some((term) => normalizedQuery.includes(normalize(term)))
}

export function buildCandidateKnowledgeContext(query: string): string {
  const queryTokens = tokensFrom(query)
  const shouldInclude = isExperienceOrTechQuestion(query) || queryTokens.length > 0

  if (!shouldInclude) return ''

  const ranked = CHUNKS
    .map((chunk) => ({ chunk, score: scoreChunk(chunk, query, queryTokens) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)

  const selectedChunks = ranked.length > 0
    ? ranked.map(({ chunk }) => chunk)
    : CHUNKS
      .filter((chunk) => ['frontend-web', 'mobile-react-native', 'backend-architecture'].includes(chunk.id))
      .slice(0, 2)

  const compactNotes = selectedChunks.map((chunk) => {
    const relevantContent = pickRelevantSentences(chunk.content, queryTokens)
    return `- ${chunk.title}: ${relevantContent}`
  })

  return `NOTAS PRIVADAS SOBRE EXPERIENCIA DO CANDIDATO:
${ALWAYS_ON_CONTEXT}

Notas factuais relevantes:
${compactNotes.join('\n')}

Instrucao de uso das notas:
- Nao copie essas notas na resposta.
- Nao mencione que existem notas, CV, memoria ou fonte local.
- Use as notas apenas para escolher exemplos reais e responder de forma natural em primeira pessoa.`
}
