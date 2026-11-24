import crypto from "node:crypto";
import type { InfraType, PlanTier } from "@prisma/client";
import {
  addMonthsUTC,
  formatBRL,
  formatDateBR,
  formatDateLongBR,
  getTodaySaoPaulo,
  parseDateInputToUTC,
} from "@/lib/format";
import { INFRA_TYPE_LABELS, PLAN_TIER_LABELS } from "@/lib/pricing";

export type ContractStatusValue = "DRAFT" | "SENT" | "SIGNED";

export const CONTRACT_STATUS_OPTIONS: ContractStatusValue[] = [
  "DRAFT",
  "SENT",
  "SIGNED",
];

export const CONTRACT_STATUS_META: Record<
  ContractStatusValue,
  { label: string; badgeClass: string; dotClass: string }
> = {
  DRAFT: {
    label: "Rascunho",
    badgeClass: "bg-slate-100 text-slate-600 border-slate-200",
    dotClass: "bg-slate-400",
  },
  SENT: {
    label: "Aguardando Assinatura",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    dotClass: "bg-amber-500",
  },
  SIGNED: {
    label: "Assinado",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dotClass: "bg-emerald-600",
  },
};

export function normalizeContractStatus(status?: string | null): ContractStatusValue {
  if (status === "SENT" || status === "SIGNED" || status === "DRAFT") {
    return status;
  }
  return "DRAFT";
}

export function generateContractToken(): string {
  return crypto.randomBytes(24).toString("hex"); // 48 chars hex
}

export function computeSha256Hex(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

export function getTierDoctorRangeText(planTier: PlanTier): string {
  switch (planTier) {
    case "SMALL":
      return "1 a 2";
    case "MEDIUM":
      return "3 a 6";
    case "LARGE":
      return "7 a 15";
    case "ENTERPRISE":
      return "16 ou mais";
  }
}

export function getFidelityEndDate(
  startDate: Date | string | null | undefined,
  fidelityMonths: number
): Date | null {
  if (!startDate) return null;
  const parsed = typeof startDate === "string" ? new Date(startDate) : startDate;
  if (Number.isNaN(parsed.getTime())) return null;
  const safeMonths = Math.max(1, Math.trunc(fidelityMonths || 12));
  return addMonthsUTC(parsed, safeMonths);
}

export function formatSetupInstallmentsLabel(
  setupFeeCents: number,
  installments: number | null | undefined
): string {
  if (setupFeeCents <= 0) {
    return "Isento";
  }
  const n = Math.trunc(installments ?? 1);
  if (n <= 1) {
    return "Pagamento único (à vista)";
  }
  const installmentCents = Math.round(setupFeeCents / n);
  return `${n}x de ${formatBRL(installmentCents)}`;
}

export interface ContractSettingsInput {
  companyName: string;
  companyLegalName: string | null;
  companyCnpj: string | null;
  companyAddress: string | null;
  companyRepName: string | null;
  companyRepCpf: string | null;
  contractCourt: string;
  defaultFidelityMonths: number;
  defaultFidelityPenaltyPct: number;
  defaultSuspensionDays: number;
  supportChannel: string;
  supportHours: string;
}

export interface ContractClinicInput {
  id: string;
  name: string;
  legalName: string | null;
  cnpj: string | null;
  address: string | null;
  responsibleName: string;
  legalRepName: string | null;
  legalRepCpf: string | null;
  subdomain: string | null;
  activeDoctors: number;
  planTier: PlanTier;
  isFounder: boolean;
  setupFeeCents: number;
  setupInstallments: number | null;
  monthlyFeeCents: number;
  dueDay: number;
  startDate: Date | string;
  contractStartDate: Date | string | null;
  fidelityMonths: number | null;
  infraType: InfraType;
}

export interface MissingFieldItem {
  key: string;
  label: string;
  source: "settings" | "clinic";
}

export const PLACEHOLDER_TAG = "[PREENCHER]";

export function buildContractPayload(
  clinic: ContractClinicInput,
  settings: ContractSettingsInput
) {
  const missingFields: MissingFieldItem[] = [];

  const requireField = (
    value: string | null | undefined,
    key: string,
    label: string,
    source: "settings" | "clinic"
  ): string => {
    const trimmed = value?.trim();
    if (!trimmed) {
      missingFields.push({ key, label, source });
      return PLACEHOLDER_TAG;
    }
    return trimmed;
  };

  const fidelityMonths =
    clinic.fidelityMonths && clinic.fidelityMonths > 0
      ? clinic.fidelityMonths
      : settings.defaultFidelityMonths || 12;

  const rawStart = clinic.contractStartDate ?? clinic.startDate;
  const startDate = rawStart
    ? typeof rawStart === "string"
      ? new Date(rawStart)
      : rawStart
    : parseDateInputToUTC(getTodaySaoPaulo().ymd);

  const endDate =
    getFidelityEndDate(startDate, fidelityMonths) ?? addMonthsUTC(startDate, 12);

  const subdomainFormatted = clinic.subdomain?.trim()
    ? `https://${clinic.subdomain.trim().replace(/^https?:\/\//, "")}`
    : null;

  const clinicRep = clinic.legalRepName?.trim() || clinic.responsibleName?.trim();
  const planLabel = `${PLAN_TIER_LABELS[clinic.planTier].label} (${getTierDoctorRangeText(
    clinic.planTier
  )} médicos ativos)`;
  const setupInstallments = Math.max(1, Math.trunc(clinic.setupInstallments ?? 1));
  const penaltyPct = settings.defaultFidelityPenaltyPct ?? 30;
  const suspensionDays = settings.defaultSuspensionDays || 15;
  const court = settings.contractCourt?.trim() || "Contagem/MG";
  const supportChannel = settings.supportChannel?.trim() || "WhatsApp";
  const supportHours =
    settings.supportHours?.trim() || "Segunda a sexta, das 08h às 18h";

  const v = {
    HQ_RAZAO_SOCIAL: requireField(
      settings.companyLegalName,
      "companyLegalName",
      "Razão Social da Contratada",
      "settings"
    ),
    HQ_CNPJ: requireField(
      settings.companyCnpj,
      "companyCnpj",
      "CNPJ da Contratada",
      "settings"
    ),
    HQ_ENDERECO: requireField(
      settings.companyAddress,
      "companyAddress",
      "Endereço da Contratada",
      "settings"
    ),
    HQ_REPRESENTANTE: requireField(
      settings.companyRepName,
      "companyRepName",
      "Representante Legal da Contratada",
      "settings"
    ),
    HQ_CPF_REPRESENTANTE: requireField(
      settings.companyRepCpf,
      "companyRepCpf",
      "CPF do Representante da Contratada",
      "settings"
    ),
    CLINICA_RAZAO_SOCIAL: requireField(
      clinic.legalName || clinic.name,
      "legalName",
      "Razão Social da Clínica",
      "clinic"
    ),
    CLINICA_CNPJ: requireField(clinic.cnpj, "cnpj", "CNPJ da Clínica", "clinic"),
    CLINICA_ENDERECO: requireField(
      clinic.address,
      "address",
      "Endereço da Clínica",
      "clinic"
    ),
    CLINICA_RESPONSAVEL: requireField(
      clinicRep,
      "legalRepName",
      "Representante Legal da Clínica",
      "clinic"
    ),
    CLINICA_CPF_RESPONSAVEL: requireField(
      clinic.legalRepCpf,
      "legalRepCpf",
      "CPF do Representante da Clínica",
      "clinic"
    ),
    CLINICA_SUBDOMINIO: requireField(
      subdomainFormatted,
      "subdomain",
      "Subdomínio Dedicado da Clínica",
      "clinic"
    ),
    DIA_VENCIMENTO: String(clinic.dueDay).padStart(2, "0"),
    DIAS_SUSPENSAO: String(suspensionDays),
    MESES_FIDELIDADE: String(fidelityMonths),
    PERCENTUAL_MULTA_FIDELIDADE: String(penaltyPct),
    CANAL_SUPORTE: supportChannel,
    HORARIO_SUPORTE: supportHours,
    FORO_CONTRATO: court,
    DATA_CONTRATO: formatDateLongBR(startDate),
    FAIXA_PLANO: PLAN_TIER_LABELS[clinic.planTier].label,
    LIMITE_MEDICOS: getTierDoctorRangeText(clinic.planTier),
    IS_FOUNDER_LABEL: clinic.isFounder
      ? "Sim (condição especial aplicada)"
      : "Não",
    VALOR_MENSAL_FORMATADO: formatBRL(clinic.monthlyFeeCents),
    VALOR_SETUP_FORMATADO: formatBRL(clinic.setupFeeCents),
    PARCELAMENTO_SETUP: formatSetupInstallmentsLabel(
      clinic.setupFeeCents,
      setupInstallments
    ),
    DATA_INICIO: formatDateBR(startDate),
    DATA_FIM_FIDELIDADE: formatDateBR(endDate),
    INFRA_DESCRICAO: INFRA_TYPE_LABELS[clinic.infraType],
  };

  const contentSnapshot = [
    `CONTRATO DE LICENCIAMENTO DE USO DE SOFTWARE (SAAS) EM INFRAESTRUTURA DEDICADA E PRESTAÇÃO DE SERVIÇOS — FRDOC 2.0`,
    ``,
    `CONTRATADA: ${v.HQ_RAZAO_SOCIAL}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${v.HQ_CNPJ}, com sede em ${v.HQ_ENDERECO}, neste ato representada por ${v.HQ_REPRESENTANTE}, CPF nº ${v.HQ_CPF_REPRESENTANTE}.`,
    ``,
    `CONTRATANTE: ${v.CLINICA_RAZAO_SOCIAL}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${v.CLINICA_CNPJ}, com sede em ${v.CLINICA_ENDERECO}, neste ato representada por ${v.CLINICA_RESPONSAVEL}, CPF nº ${v.CLINICA_CPF_RESPONSAVEL}.`,
    ``,
    `CLÁUSULA 1ª — DO OBJETO E INFRAESTRUTURA DEDICADA`,
    `1.1. O presente contrato tem por objeto o licenciamento temporário, não exclusivo e intransferível de uso do software de gestão médica FRdoc 2.0, disponibilizado no modelo SaaS (Software as a Service) no endereço dedicado ${v.CLINICA_SUBDOMINIO}, acompanhado de serviços de hospedagem, manutenção corretiva e suporte técnico.`,
    `1.2. Ambiente Exclusivo: A CONTRATADA disponibilizará à CONTRATANTE ambiente computacional isolado (servidor virtual dedicado e banco de dados exclusivo hospedados em território nacional), sem compartilhamento de base de dados com outras clínicas clientes.`,
    `1.3. O presente contrato não implica venda, cessão ou transferência de código-fonte, propriedade intelectual ou titularidade sobre o software ou infraestrutura.`,
    ``,
    `CLÁUSULA 2ª — DAS FAIXAS DE USO E UPGRADE AUTOMÁTICO`,
    `2.1. O licenciamento é enquadrado conforme o porte da clínica e a quantidade de profissionais médicos ativos cadastrados no sistema: Pequena (1 a 2 médicos), Média (3 a 6 médicos), Grande (7 a 15 médicos) ou Enterprise (16 ou mais médicos).`,
    `2.2. Caso a CONTRATANTE ultrapasse o limite de médicos ativos da faixa contratada no Anexo I, o sistema realizará o reenquadramento automático para a faixa imediatamente superior no ciclo de faturamento subsequente, acompanhado da respectiva adequação da capacidade do servidor dedicado.`,
    ``,
    `CLÁUSULA 3ª — DOS VALORES, IMPLANTAÇÃO (SETUP), REAJUSTE E INADIMPLÊNCIA`,
    `3.1. Pelos serviços contratados, a CONTRATANTE pagará os valores de Implantação (Setup) e Mensalidade Recorrente especificados no Anexo I — Quadro Resumo Comercial, via PIX ou boleto bancário, até o dia ${v.DIA_VENCIMENTO} de cada mês.`,
    `3.2. A taxa de Implantação (Setup) remunera o provisionamento do servidor exclusivo, configuração de domínio/SSL e preparação inicial do ambiente, não sendo reembolsável após a entrega do acesso.`,
    `3.3. Condição de Clínica Fundadora (aplicável apenas se assinalado no Anexo I): O desconto promocional concedido na condição de Clínica Fundadora vincula-se à manutenção ininterrupta do contrato e à pontualidade dos pagamentos, perdendo-se definitivamente em caso de cancelamento ou inadimplência superior a 30 (trinta) dias.`,
    `3.4. Inadimplência e Suspensão: O atraso no pagamento sujeitará o débito a multa moratória de 2% (dois por cento) e juros de 1% (um por cento) ao mês, calculados pro rata die. Persistindo o atraso por mais de ${v.DIAS_SUSPENSAO} dias corridos após notificação, o acesso ao sistema poderá ser temporariamente suspenso sem exclusão dos dados, sendo restabelecido em até 1 (um) dia útil após a compensação do pagamento.`,
    `3.5. Reajuste: Os valores mensais serão reajustados anualmente, a cada 12 (doze) meses de vigência, pela variação positiva acumulada do IPCA (IBGE) ou outro índice oficial que venha a substituí-lo.`,
    ``,
    `CLÁUSULA 4ª — DA VIGÊNCIA, FIDELIDADE E RESCISÃO`,
    `4.1. Prazo de Fidelidade: Em razão dos custos de provisionamento de servidor dedicado exclusivo e implantação personalizada, o presente contrato possui prazo mínimo de fidelidade de ${v.MESES_FIDELIDADE} meses, contados da data de assinatura/liberação de acesso.`,
    `4.2. Rescisão Antecipada: Caso a CONTRATANTE solicite o cancelamento imotivado antes do término do período de fidelidade, incidirá multa compensatória proporcional equivalente a ${v.PERCENTUAL_MULTA_FIDELIDADE}% sobre o somatório das mensalidades vincendas até o encerramento do prazo mínimo, além da quitação integral de eventuais parcelas pendentes de Implantação (Setup).`,
    `4.3. Renovação e Aviso Prévio: Encerrado o período de fidelidade, o contrato renova-se automaticamente por prazo indeterminado, podendo ser rescindido por qualquer das partes sem multa, mediante aviso prévio formal com antecedência mínima de 30 (trinta) dias.`,
    `4.4. Rescisão por Inadimplência Prolongada: O atraso superior a 60 (sessenta) dias faculta à CONTRATADA a rescisão imediata do contrato, sem prejuízo da cobrança dos débitos em aberto e da multa proporcional prevista na Cláusula 4.2.`,
    ``,
    `CLÁUSULA 5ª — DISPONIBILIDADE (SLA), BACKUPS E SUPORTE`,
    `5.1. A CONTRATADA empenhará seus melhores esforços para manter disponibilidade mensal alvo de 99% (noventa e nove por cento), não se computando interrupções decorrentes de: (a) janelas de manutenção preventiva comunicadas previamente, realizadas preferencialmente fora do horário comercial; (b) falhas na conexão de internet ou equipamentos da CONTRATANTE; ou (c) casos fortuitos, força maior ou indisponibilidade generalizada de terceiros.`,
    `5.2. A CONTRATADA manterá rotina automatizada de backups diários criptografados do banco de dados em armazenamento externo ao servidor principal.`,
    `5.3. O suporte técnico será prestado remotamente por meio de ${v.CANAL_SUPORTE}, no horário de ${v.HORARIO_SUPORTE}.`,
    ``,
    `CLÁUSULA 6ª — RESPONSABILIDADE MÉDICA E GUARDA DE PRONTUÁRIOS (CFM)`,
    `6.1. O FRdoc 2.0 constitui ferramenta tecnológica de apoio administrativo e registro eletrônico. A CONTRATADA não interfere na prática clínica e não assume qualquer responsabilidade por diagnósticos, prescrições, condutas médicas, preenchimento incorreto ou veracidade dos dados inseridos pelos usuários.`,
    `6.2. A obrigação legal de guarda dos prontuários médicos pelo prazo mínimo de 20 (vinte) anos (Lei nº 13.787/2018 e normas do Conselho Federal de Medicina) é de responsabilidade exclusiva da CONTRATANTE, cabendo-lhe manter exportações periódicas e solicitar a extração integral de sua base ao término deste contrato.`,
    ``,
    `CLÁUSULA 7ª — PORTABILIDADE E DESCOMISSIONAMENTO DO SERVIDOR`,
    `7.1. Em caso de encerramento do contrato por qualquer motivo, mediante quitação das obrigações vencidas, a CONTRATADA disponibilizará à CONTRATANTE a exportação dos dados cadastrais e registros em formato estruturado legível em até 15 (quinze) dias corridos.`,
    `7.2. Decorridos 30 (trinta) dias após a entrega dos dados ou do encerramento definitivo do contrato sem manifestação da CONTRATANTE, o servidor dedicado e todos os respectivos backups serão excluídos de forma irreversível por razões de segurança e conformidade legal.`,
    ``,
    `CLÁUSULA 8ª — PROPRIEDADE INTELECTUAL E CONFIDENCIALIDADE`,
    `8.1. Todos os direitos sobre o software FRdoc 2.0, sua marca, layout, bancos estruturais e documentação pertencem exclusivamente à CONTRATADA, sendo vedada engenharia reversa, cópia, sublicenciamento ou compartilhamento de credenciais com terceiros não autorizados.`,
    `8.2. Ambas as partes obrigam-se a manter sigilo absoluto sobre informações comerciais, técnicas e dados de pacientes a que tenham acesso em razão deste contrato, subsistindo o dever de confidencialidade mesmo após seu término.`,
    ``,
    `CLÁUSULA 9ª — DO FORO`,
    `9.1. As partes elegem o foro da Comarca de ${v.FORO_CONTRATO}, com renúncia expressa a qualquer outro, por mais privilegiado que seja, para dirimir quaisquer controvérsias oriundas deste contrato.`,
    ``,
    `E, por estarem justas e contratadas, assinam o presente instrumento eletronicamente, com plena validade jurídica nos termos da Medida Provisória nº 2.200-2/2001 e da Lei nº 14.063/2020.`,
    ``,
    `${v.FORO_CONTRATO}, ${v.DATA_CONTRATO}.`,
    ``,
    `=== PAGE_BREAK ===`,
    `ANEXO I — QUADRO RESUMO COMERCIAL`,
    `• Clínica Contratante: ${v.CLINICA_RAZAO_SOCIAL} — CNPJ ${v.CLINICA_CNPJ}`,
    `• Endereço de Acesso Dedicado: ${v.CLINICA_SUBDOMINIO}`,
    `• Faixa / Porte Contratado: ${v.FAIXA_PLANO} (${v.LIMITE_MEDICOS} médicos ativos)`,
    `• Clínica Fundadora: ${v.IS_FOUNDER_LABEL}`,
    `• Valor da Mensalidade: ${v.VALOR_MENSAL_FORMATADO}`,
    `• Dia de Vencimento: Todo dia ${v.DIA_VENCIMENTO} de cada mês`,
    `• Taxa de Implantação (Setup): ${v.VALOR_SETUP_FORMATADO} (${v.PARCELAMENTO_SETUP})`,
    `• Prazo de Fidelidade: ${v.MESES_FIDELIDADE} meses (${v.DATA_INICIO} a ${v.DATA_FIM_FIDELIDADE})`,
    `• Multa por Rescisão Antecipada: ${v.PERCENTUAL_MULTA_FIDELIDADE}% sobre as mensalidades restantes`,
    `• Infraestrutura Alocada: Servidor Dedicado Isolado (${v.INFRA_DESCRICAO})`,
    ``,
    `=== PAGE_BREAK ===`,
    `ANEXO II — TERMO DE PROTEÇÃO DE DADOS PESSOAIS (DPA — LGPD)`,
    `1. Papéis Legais: Para fins da Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018), a CONTRATANTE atua como Controladora dos dados pessoais e dados pessoais sensíveis de saúde de seus pacientes e colaboradores, e a CONTRATADA atua estritamente como Operadora, tratando os dados exclusivamente conforme as finalidades deste contrato.`,
    `2. Base Legal e Consentimento: Compete exclusivamente à CONTRATANTE assegurar base legal adequada para a coleta e inserção dos dados de pacientes no sistema, bem como atender às solicitações dos titulares de dados.`,
    `3. Medidas Técnicas de Segurança: A CONTRATADA adota medidas proporcionais à sensibilidade dos dados de saúde, incluindo isolamento em servidor e banco de dados exclusivos por clínica, criptografia em trânsito (HTTPS/TLS), controle restrito de acesso administrativo e rotina de backups diários criptografados.`,
    `4. Suboperadores: A CONTRATANTE autoriza a utilização de provedores de infraestrutura em nuvem/datacenter localizados no Brasil e serviços essenciais de armazenamento de backup, permanecendo a CONTRATADA responsável pela observância de padrões de segurança equivalentes.`,
    `5. Incidentes de Segurança: Em caso de incidente de segurança confirmado que possa acarretar risco ou dano relevante aos dados hospedados, a CONTRATADA comunicará a CONTRATANTE em até 48 (quarenta e oito) horas após a confirmação técnica, fornecendo as informações disponíveis para adoção das medidas cabíveis.`,
    `6. Eliminação: Encerrado o contrato, os dados serão devolvidos e eliminados na forma da Cláusula 7ª do Contrato Principal.`,
  ].join("\n");

  const documentHash = computeSha256Hex(contentSnapshot);

  return {
    variables: v,
    missingFields,
    contentSnapshot,
    documentHash,
    planSnapshot: planLabel,
    monthlyFeeSnapshot: clinic.monthlyFeeCents,
    setupFeeSnapshot: clinic.setupFeeCents,
    setupInstallments,
    isFounderSnapshot: clinic.isFounder,
    dueDaySnapshot: clinic.dueDay,
    infraSnapshot: v.INFRA_DESCRICAO,
    penaltyPctSnapshot: penaltyPct,
    courtSnapshot: court,
    clinicLegalNameSnapshot: v.CLINICA_RAZAO_SOCIAL,
    clinicCnpjSnapshot: v.CLINICA_CNPJ,
    clinicSubdomainSnapshot: v.CLINICA_SUBDOMINIO,
    hqLegalNameSnapshot: v.HQ_RAZAO_SOCIAL,
    hqCnpjSnapshot: v.HQ_CNPJ,
    fidelityMonths,
    startDate,
    endDate,
  };
}
