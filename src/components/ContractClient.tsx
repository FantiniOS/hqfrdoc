"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Printer,
  ShieldCheck,
} from "lucide-react";
import {
  CONTRACT_STATUS_META,
  CONTRACT_STATUS_OPTIONS,
  normalizeContractStatus,
  PLACEHOLDER_TAG,
  resolveContractData,
  type ContractClinicInput,
  type ContractSettingsInput,
  type ContractStatusValue,
} from "@/lib/contract";

function Field({
  value,
  strong = false,
}: {
  value: string;
  strong?: boolean;
}) {
  if (value === PLACEHOLDER_TAG) {
    return (
      <span className="inline-block rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[0.88em] font-semibold text-amber-900 ring-1 ring-amber-300">
        {PLACEHOLDER_TAG}
      </span>
    );
  }
  if (strong) {
    return <strong className="font-semibold text-slate-950">{value}</strong>;
  }
  return <>{value}</>;
}

export function ContractClient({
  clinic,
  settings,
}: {
  clinic: ContractClinicInput;
  settings: ContractSettingsInput;
}) {
  const [contractStatus, setContractStatus] = useState<ContractStatusValue>(() =>
    normalizeContractStatus(clinic.contractStatus)
  );
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const { variables: v, missingFields } = useMemo(
    () => resolveContractData(clinic, settings),
    [clinic, settings]
  );

  const missingSettingsFields = missingFields.filter((f) => f.source === "settings");
  const missingClinicFields = missingFields.filter((f) => f.source === "clinic");

  async function handleStatusChange(nextStatus: ContractStatusValue) {
    setContractStatus(nextStatus);
    setSavingStatus(true);
    setStatusMessage(null);

    try {
      const res = await fetch(`/api/clinics/${clinic.id}/contract`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractStatus: nextStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatusMessage({
          type: "error",
          text: data.error ?? "Erro ao atualizar status do contrato.",
        });
        setContractStatus(normalizeContractStatus(clinic.contractStatus));
      } else {
        setStatusMessage({
          type: "success",
          text: `Status salvo como "${CONTRACT_STATUS_META[nextStatus].label}".`,
        });
      }
    } catch {
      setStatusMessage({
        type: "error",
        text: "Falha de conexão ao salvar o status.",
      });
    } finally {
      setSavingStatus(false);
    }
  }

  const currentMeta = CONTRACT_STATUS_META[contractStatus];

  const commercialRows: Array<{ label: string; value: string; extra?: string }> = [
    {
      label: "Clínica Contratante",
      value:
        v.CLINICA_RAZAO_SOCIAL === PLACEHOLDER_TAG || v.CLINICA_CNPJ === PLACEHOLDER_TAG
          ? "__CLINICA_COMPOSTA__"
          : `${v.CLINICA_RAZAO_SOCIAL} — CNPJ ${v.CLINICA_CNPJ}`,
    },
    {
      label: "Endereço de Acesso Dedicado",
      value: v.CLINICA_SUBDOMINIO,
    },
    {
      label: "Faixa / Porte Contratado",
      value: `${v.FAIXA_PLANO} (${v.LIMITE_MEDICOS} médicos ativos)`,
    },
    {
      label: "Clínica Fundadora",
      value: v.IS_FOUNDER_LABEL,
    },
    {
      label: "Valor da Mensalidade",
      value: v.VALOR_MENSAL_FORMATADO,
    },
    {
      label: "Dia de Vencimento",
      value: `Todo dia ${v.DIA_VENCIMENTO} de cada mês`,
    },
    {
      label: "Taxa de Implantação (Setup)",
      value: `${v.VALOR_SETUP_FORMATADO} (${v.PARCELAMENTO_SETUP})`,
    },
    {
      label: "Prazo de Fidelidade",
      value: `${v.MESES_FIDELIDADE} meses (${v.DATA_INICIO} a ${v.DATA_FIM_FIDELIDADE})`,
    },
    {
      label: "Multa por Rescisão Antecipada",
      value: `${v.PERCENTUAL_MULTA_FIDELIDADE}% sobre as mensalidades restantes`,
    },
    {
      label: "Infraestrutura Alocada",
      value: `Servidor Dedicado Isolado (${v.INFRA_DESCRICAO})`,
    },
  ];

  return (
    <div className="space-y-5 print:space-y-0">
      {/* Barra de Controle Superior — Oculta na impressão */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs print:hidden">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/clinicas"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar
            </Link>
            <div>
              <h1 className="text-base font-semibold text-slate-900">
                Contrato SaaS FRdoc 2.0 — {clinic.name}
              </h1>
              <p className="text-xs text-slate-600">
                Documento editorial A4 pronto para conferência e exportação em PDF
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Seletor de Status do Contrato */}
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5">
              <span className="text-xs font-medium text-slate-600">
                Status do Contrato:
              </span>
              <select
                aria-label="Status do Contrato"
                value={contractStatus}
                disabled={savingStatus}
                onChange={(e) =>
                  void handleStatusChange(e.target.value as ContractStatusValue)
                }
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60"
              >
                {CONTRACT_STATUS_OPTIONS.map((st) => (
                  <option key={st} value={st}>
                    {CONTRACT_STATUS_META[st].label}
                  </option>
                ))}
              </select>
              {savingStatus ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
              ) : (
                <span
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${currentMeta.badgeClass}`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${currentMeta.dotClass}`}
                  />
                  {currentMeta.label}
                </span>
              )}
            </div>

            {/* Botão Imprimir / Salvar PDF */}
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-700"
            >
              <Printer className="h-4 w-4" />
              Imprimir / Salvar PDF
            </button>
          </div>
        </div>

        {statusMessage && (
          <div
            className={`mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium ${
              statusMessage.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            {statusMessage.type === "success" && (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}
      </div>

      {/* Alerta de campos pendentes [PREENCHER] — Oculto na impressão */}
      {missingFields.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-2xs print:hidden">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="space-y-1 text-xs">
                <p className="font-semibold text-amber-900">
                  Atenção: {missingFields.length} campo(s) jurídico(s) ainda estão marcados como{" "}
                  <span className="rounded bg-amber-200/80 px-1 py-0.5 font-mono">
                    {PLACEHOLDER_TAG}
                  </span>
                </p>
                {missingSettingsFields.length > 0 && (
                  <p className="text-amber-800">
                    <strong>Contratada (Configurações):</strong>{" "}
                    {missingSettingsFields.map((f) => f.label).join(", ")}.
                  </p>
                )}
                {missingClinicFields.length > 0 && (
                  <p className="text-amber-800">
                    <strong>Contratante (Clínica):</strong>{" "}
                    {missingClinicFields.map((f) => f.label).join(", ")}.
                  </p>
                )}
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {missingSettingsFields.length > 0 && (
                <Link
                  href="/configuracoes"
                  className="rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100"
                >
                  Preencher Configurações
                </Link>
              )}
              {missingClinicFields.length > 0 && (
                <Link
                  href="/clinicas"
                  className="rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100"
                >
                  Editar Clínica
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Folha Editorial A4 */}
      <article className="mx-auto max-w-[210mm] rounded-2xl border border-slate-200 bg-white px-8 py-10 text-slate-900 shadow-sm sm:px-14 sm:py-12 print:m-0 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
        {/* Cabeçalho discreto FRdoc */}
        <header className="mb-8 flex items-center justify-between border-b-2 border-emerald-600/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold tracking-tight text-slate-950">
                  FRdoc
                </span>
                <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-emerald-700 uppercase">
                  2.0
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Instrumento Particular de Licenciamento SaaS & Infraestrutura Dedicada
              </p>
            </div>
          </div>
          <div className="text-right text-[11px] text-slate-500">
            <p className="font-mono-num font-semibold text-slate-700">
              REF: FRDOC-{clinic.id.slice(-6).toUpperCase()}
            </p>
            <p>{v.DATA_INICIO}</p>
          </div>
        </header>

        {/* Título Principal */}
        <h2 className="mb-6 text-center text-[15px] leading-snug font-bold tracking-tight text-slate-950 uppercase">
          CONTRATO DE LICENCIAMENTO DE USO DE SOFTWARE (SAAS) EM INFRAESTRUTURA
          DEDICADA E PRESTAÇÃO DE SERVIÇOS — FRDOC 2.0
        </h2>

        {/* Corpo Editorial */}
        <div className="space-y-4 text-justify text-[13px] leading-relaxed text-slate-800">
          {/* Qualificação das Partes */}
          <p>
            <strong className="font-semibold text-slate-950">CONTRATADA:</strong>{" "}
            <Field value={v.HQ_RAZAO_SOCIAL} strong />, pessoa jurídica de direito
            privado, inscrita no CNPJ sob o nº <Field value={v.HQ_CNPJ} strong />,
            com sede em <Field value={v.HQ_ENDERECO} />, neste ato representada por{" "}
            <Field value={v.HQ_REPRESENTANTE} strong />, CPF nº{" "}
            <Field value={v.HQ_CPF_REPRESENTANTE} strong />.
          </p>

          <p>
            <strong className="font-semibold text-slate-950">CONTRATANTE:</strong>{" "}
            <Field value={v.CLINICA_RAZAO_SOCIAL} strong />, pessoa jurídica de
            direito privado, inscrita no CNPJ sob o nº{" "}
            <Field value={v.CLINICA_CNPJ} strong />, com sede em{" "}
            <Field value={v.CLINICA_ENDERECO} />, neste ato representada por{" "}
            <Field value={v.CLINICA_RESPONSAVEL} strong />, CPF nº{" "}
            <Field value={v.CLINICA_CPF_RESPONSAVEL} strong />.
          </p>

          {/* Cláusula 1ª */}
          <section className="space-y-2 pt-2">
            <h3 className="text-[13px] font-bold tracking-tight text-slate-950 uppercase">
              CLÁUSULA 1ª — DO OBJETO E INFRAESTRUTURA DEDICADA
            </h3>
            <p>
              <strong>1.1.</strong> O presente contrato tem por objeto o
              licenciamento temporário, não exclusivo e intransferível de uso do
              software de gestão médica FRdoc 2.0, disponibilizado no modelo SaaS
              (Software as a Service) no endereço dedicado{" "}
              <Field value={v.CLINICA_SUBDOMINIO} strong />, acompanhado de
              serviços de hospedagem, manutenção corretiva e suporte técnico.
            </p>
            <p>
              <strong>1.2. Ambiente Exclusivo:</strong> A CONTRATADA disponibilizará
              à CONTRATANTE ambiente computacional isolado (servidor virtual dedicado
              e banco de dados exclusivo hospedados em território nacional), sem
              compartilhamento de base de dados com outras clínicas clientes.
            </p>
            <p>
              <strong>1.3.</strong> O presente contrato não implica venda, cessão ou
              transferência de código-fonte, propriedade intelectual ou titularidade
              sobre o software ou infraestrutura.
            </p>
          </section>

          {/* Cláusula 2ª */}
          <section className="space-y-2 pt-2">
            <h3 className="text-[13px] font-bold tracking-tight text-slate-950 uppercase">
              CLÁUSULA 2ª — DAS FAIXAS DE USO E UPGRADE AUTOMÁTICO
            </h3>
            <p>
              <strong>2.1.</strong> O licenciamento é enquadrado conforme o porte da
              clínica e a quantidade de profissionais médicos ativos cadastrados no
              sistema: Pequena (1 a 2 médicos), Média (3 a 6 médicos), Grande (7 a 15
              médicos) ou Enterprise (16 ou mais médicos).
            </p>
            <p>
              <strong>2.2.</strong> Caso a CONTRATANTE ultrapasse o limite de médicos
              ativos da faixa contratada no Anexo I, o sistema realizará o
              reenquadramento automático para a faixa imediatamente superior no ciclo
              de faturamento subsequente, acompanhado da respectiva adequação da
              capacidade do servidor dedicado.
            </p>
          </section>

          {/* Cláusula 3ª */}
          <section className="space-y-2 pt-2">
            <h3 className="text-[13px] font-bold tracking-tight text-slate-950 uppercase">
              CLÁUSULA 3ª — DOS VALORES, IMPLANTAÇÃO (SETUP), REAJUSTE E INADIMPLÊNCIA
            </h3>
            <p>
              <strong>3.1.</strong> Pelos serviços contratados, a CONTRATANTE pagará
              os valores de Implantação (Setup) e Mensalidade Recorrente especificados
              no Anexo I — Quadro Resumo Comercial, via PIX ou boleto bancário, até o
              dia <Field value={v.DIA_VENCIMENTO} strong /> de cada mês.
            </p>
            <p>
              <strong>3.2.</strong> A taxa de Implantação (Setup) remunera o
              provisionamento do servidor exclusivo, configuração de domínio/SSL e
              preparação inicial do ambiente, não sendo reembolsável após a entrega do
              acesso.
            </p>
            <p>
              <strong>3.3. Condição de Clínica Fundadora</strong> (aplicável apenas se
              assinalado no Anexo I): O desconto promocional concedido na condição de
              Clínica Fundadora vincula-se à manutenção ininterrupta do contrato e à
              pontualidade dos pagamentos, perdendo-se definitivamente em caso de
              cancelamento ou inadimplência superior a 30 (trinta) dias.
            </p>
            <p>
              <strong>3.4. Inadimplência e Suspensão:</strong> O atraso no pagamento
              sujeitará o débito a multa moratória de 2% (dois por cento) e juros de
              1% (um por cento) ao mês, calculados pro rata die. Persistindo o atraso
              por mais de <Field value={v.DIAS_SUSPENSAO} strong /> dias corridos após
              notificação, o acesso ao sistema poderá ser temporariamente suspenso sem
              exclusão dos dados, sendo restabelecido em até 1 (um) dia útil após a
              compensação do pagamento.
            </p>
            <p>
              <strong>3.5. Reajuste:</strong> Os valores mensais serão reajustados
              anualmente, a cada 12 (doze) meses de vigência, pela variação positiva
              acumulada do IPCA (IBGE) ou outro índice oficial que venha a
              substituí-lo.
            </p>
          </section>

          {/* Cláusula 4ª */}
          <section className="space-y-2 pt-2">
            <h3 className="text-[13px] font-bold tracking-tight text-slate-950 uppercase">
              CLÁUSULA 4ª — DA VIGÊNCIA, FIDELIDADE E RESCISÃO
            </h3>
            <p>
              <strong>4.1. Prazo de Fidelidade:</strong> Em razão dos custos de
              provisionamento de servidor dedicado exclusivo e implantação
              personalizada, o presente contrato possui prazo mínimo de fidelidade de{" "}
              <Field value={v.MESES_FIDELIDADE} strong /> meses, contados da data de
              assinatura/liberação de acesso.
            </p>
            <p>
              <strong>4.2. Rescisão Antecipada:</strong> Caso a CONTRATANTE solicite o
              cancelamento imotivado antes do término do período de fidelidade,
              incidirá multa compensatória proporcional equivalente a{" "}
              <Field value={v.PERCENTUAL_MULTA_FIDELIDADE} strong />% sobre o
              somatório das mensalidades vincendas até o encerramento do prazo mínimo,
              além da quitação integral de eventuais parcelas pendentes de Implantação
              (Setup).
            </p>
            <p>
              <strong>4.3. Renovação e Aviso Prévio:</strong> Encerrado o período de
              fidelidade, o contrato renova-se automaticamente por prazo
              indeterminado, podendo ser rescindido por qualquer das partes sem multa,
              mediante aviso prévio formal com antecedência mínima de 30 (trinta)
              dias.
            </p>
            <p>
              <strong>4.4. Rescisão por Inadimplência Prolongada:</strong> O atraso
              superior a 60 (sessenta) dias faculta à CONTRATADA a rescisão imediata
              do contrato, sem prejuízo da cobrança dos débitos em aberto e da multa
              proporcional prevista na Cláusula 4.2.
            </p>
          </section>

          {/* Cláusula 5ª */}
          <section className="space-y-2 pt-2">
            <h3 className="text-[13px] font-bold tracking-tight text-slate-950 uppercase">
              CLÁUSULA 5ª — DISPONIBILIDADE (SLA), BACKUPS E SUPORTE
            </h3>
            <p>
              <strong>5.1.</strong> A CONTRATADA empenhará seus melhores esforços para
              manter disponibilidade mensal alvo de 99% (noventa e nove por cento),
              não se computando interrupções decorrentes de: (a) janelas de manutenção
              preventiva comunicadas previamente, realizadas preferencialmente fora do
              horário comercial; (b) falhas na conexão de internet ou equipamentos da
              CONTRATANTE; ou (c) casos fortuitos, força maior ou indisponibilidade
              generalizada de terceiros.
            </p>
            <p>
              <strong>5.2.</strong> A CONTRATADA manterá rotina automatizada de
              backups diários criptografados do banco de dados em armazenamento
              externo ao servidor principal.
            </p>
            <p>
              <strong>5.3.</strong> O suporte técnico será prestado remotamente por
              meio de <Field value={v.CANAL_SUPORTE} strong />, no horário de{" "}
              <Field value={v.HORARIO_SUPORTE} strong />.
            </p>
          </section>

          {/* Cláusula 6ª */}
          <section className="space-y-2 pt-2">
            <h3 className="text-[13px] font-bold tracking-tight text-slate-950 uppercase">
              CLÁUSULA 6ª — RESPONSABILIDADE MÉDICA E GUARDA DE PRONTUÁRIOS (CFM)
            </h3>
            <p>
              <strong>6.1.</strong> O FRdoc 2.0 constitui ferramenta tecnológica de
              apoio administrativo e registro eletrônico. A CONTRATADA não interfere
              na prática clínica e não assume qualquer responsabilidade por
              diagnósticos, prescrições, condutas médicas, preenchimento incorreto ou
              veracidade dos dados inseridos pelos usuários.
            </p>
            <p>
              <strong>6.2.</strong> A obrigação legal de guarda dos prontuários
              médicos pelo prazo mínimo de 20 (vinte) anos (Lei nº 13.787/2018 e
              normas do Conselho Federal de Medicina) é de responsabilidade exclusiva
              da CONTRATANTE, cabendo-lhe manter exportações periódicas e solicitar a
              extração integral de sua base ao término deste contrato.
            </p>
          </section>

          {/* Cláusula 7ª */}
          <section className="space-y-2 pt-2">
            <h3 className="text-[13px] font-bold tracking-tight text-slate-950 uppercase">
              CLÁUSULA 7ª — PORTABILIDADE E DESCOMISSIONAMENTO DO SERVIDOR
            </h3>
            <p>
              <strong>7.1.</strong> Em caso de encerramento do contrato por qualquer
              motivo, mediante quitação das obrigações vencidas, a CONTRATADA
              disponibilizará à CONTRATANTE a exportação dos dados cadastrais e
              registros em formato estruturado legível em até 15 (quinze) dias
              corridos.
            </p>
            <p>
              <strong>7.2.</strong> Decorridos 30 (trinta) dias após a entrega dos
              dados ou do encerramento definitivo do contrato sem manifestação da
              CONTRATANTE, o servidor dedicado e todos os respectivos backups serão
              excluídos de forma irreversível por razões de segurança e conformidade
              legal.
            </p>
          </section>

          {/* Cláusula 8ª */}
          <section className="space-y-2 pt-2">
            <h3 className="text-[13px] font-bold tracking-tight text-slate-950 uppercase">
              CLÁUSULA 8ª — PROPRIEDADE INTELECTUAL E CONFIDENCIALIDADE
            </h3>
            <p>
              <strong>8.1.</strong> Todos os direitos sobre o software FRdoc 2.0, sua
              marca, layout, bancos estruturais e documentação pertencem
              exclusivamente à CONTRATADA, sendo vedada engenharia reversa, cópia,
              sublicenciamento ou compartilhamento de credenciais com terceiros não
              autorizados.
            </p>
            <p>
              <strong>8.2.</strong> Ambas as partes obrigam-se a manter sigilo
              absoluto sobre informações comerciais, técnicas e dados de pacientes a
              que tenham acesso em razão deste contrato, subsistindo o dever de
              confidencialidade mesmo após seu término.
            </p>
          </section>

          {/* Cláusula 9ª */}
          <section className="space-y-2 pt-2">
            <h3 className="text-[13px] font-bold tracking-tight text-slate-950 uppercase">
              CLÁUSULA 9ª — DO FORO
            </h3>
            <p>
              <strong>9.1.</strong> As partes elegem o foro da Comarca de{" "}
              <Field value={v.FORO_CONTRATO} strong />, com renúncia expressa a
              qualquer outro, por mais privilegiado que seja, para dirimir quaisquer
              controvérsias oriundas deste contrato.
            </p>
          </section>

          {/* Fecho e Assinaturas */}
          <div className="contract-avoid-break space-y-6 pt-4">
            <p>
              E, por estarem justas e contratadas, assinam o presente instrumento
              eletronicamente, com plena validade jurídica nos termos da Medida
              Provisória nº 2.200-2/2001 e da Lei nº 14.063/2020.
            </p>

            <p className="text-right font-medium text-slate-900">
              <Field value={v.FORO_CONTRATO} />, <Field value={v.DATA_CONTRATO} />.
            </p>

            <div className="grid grid-cols-1 gap-8 pt-8 sm:grid-cols-2">
              <div className="text-center">
                <div className="mx-auto mb-2 w-full border-t border-slate-400" />
                <p className="text-xs font-bold tracking-wide text-slate-900 uppercase">
                  CONTRATADA
                </p>
                <p className="mt-1 text-xs font-medium text-slate-800">
                  <Field value={v.HQ_RAZAO_SOCIAL} />
                </p>
                <p className="text-[11px] text-slate-600">
                  CNPJ: <Field value={v.HQ_CNPJ} />
                </p>
                <p className="mt-1 text-[11px] text-slate-600">
                  Rep.: <Field value={v.HQ_REPRESENTANTE} /> · CPF:{" "}
                  <Field value={v.HQ_CPF_REPRESENTANTE} />
                </p>
              </div>

              <div className="text-center">
                <div className="mx-auto mb-2 w-full border-t border-slate-400" />
                <p className="text-xs font-bold tracking-wide text-slate-900 uppercase">
                  CONTRATANTE
                </p>
                <p className="mt-1 text-xs font-medium text-slate-800">
                  <Field value={v.CLINICA_RAZAO_SOCIAL} />
                </p>
                <p className="text-[11px] text-slate-600">
                  CNPJ: <Field value={v.CLINICA_CNPJ} />
                </p>
                <p className="mt-1 text-[11px] text-slate-600">
                  Rep.: <Field value={v.CLINICA_RESPONSAVEL} /> · CPF:{" "}
                  <Field value={v.CLINICA_CPF_RESPONSAVEL} />
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Separador visual de quebra de página (tela) + quebra real (impressão) */}
        <div className="my-10 flex items-center gap-3 print:hidden">
          <div className="h-px flex-1 border-t border-dashed border-slate-300" />
          <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
            Quebra de Página — Anexo I
          </span>
          <div className="h-px flex-1 border-t border-dashed border-slate-300" />
        </div>

        {/* ANEXO I — QUADRO RESUMO COMERCIAL */}
        <section className="contract-page-break space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <p className="text-[10px] font-semibold tracking-wider text-emerald-700 uppercase">
                FRdoc 2.0 · Documento Integrante ao Contrato Principal
              </p>
              <h2 className="mt-0.5 text-[15px] font-bold tracking-tight text-slate-950 uppercase">
                ANEXO I — QUADRO RESUMO COMERCIAL
              </h2>
            </div>
            <span className="font-mono-num text-[11px] text-slate-500">
              REF: FRDOC-{clinic.id.slice(-6).toUpperCase()}
            </span>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-300">
            <table className="w-full border-collapse text-left text-[13px]">
              <tbody className="divide-y divide-slate-200">
                {commercialRows.map((row) => (
                  <tr key={row.label} className="even:bg-slate-50/70">
                    <th className="w-[38%] bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-700">
                      {row.label}
                    </th>
                    <td className="px-4 py-3 text-[13px] font-medium text-slate-900">
                      {row.value === "__CLINICA_COMPOSTA__" ? (
                        <>
                          <Field value={v.CLINICA_RAZAO_SOCIAL} strong /> — CNPJ{" "}
                          <Field value={v.CLINICA_CNPJ} strong />
                        </>
                      ) : (
                        <Field value={row.value} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs leading-relaxed text-slate-600">
            Este Quadro Resumo Comercial integra o Contrato de Licenciamento de Uso de
            Software (SaaS) FRdoc 2.0 para todos os fins de direito, prevalecendo os
            valores e condições comerciais nele descritos.
          </p>
        </section>

        {/* Separador visual de quebra de página (tela) + quebra real (impressão) */}
        <div className="my-10 flex items-center gap-3 print:hidden">
          <div className="h-px flex-1 border-t border-dashed border-slate-300" />
          <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
            Quebra de Página — Anexo II
          </span>
          <div className="h-px flex-1 border-t border-dashed border-slate-300" />
        </div>

        {/* ANEXO II — TERMO DE PROTEÇÃO DE DADOS PESSOAIS (DPA — LGPD) */}
        <section className="contract-page-break space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <p className="text-[10px] font-semibold tracking-wider text-emerald-700 uppercase">
                FRdoc 2.0 · Conformidade Lei nº 13.709/2018 (LGPD)
              </p>
              <h2 className="mt-0.5 text-[15px] font-bold tracking-tight text-slate-950 uppercase">
                ANEXO II — TERMO DE PROTEÇÃO DE DADOS PESSOAIS (DPA — LGPD)
              </h2>
            </div>
            <span className="font-mono-num text-[11px] text-slate-500">
              REF: FRDOC-{clinic.id.slice(-6).toUpperCase()}
            </span>
          </div>

          <div className="space-y-3.5 text-justify text-[13px] leading-relaxed text-slate-800">
            <p>
              <strong className="font-semibold text-slate-950">
                1. Papéis Legais:
              </strong>{" "}
              Para fins da Lei Geral de Proteção de Dados Pessoais (Lei nº
              13.709/2018), a CONTRATANTE atua como Controladora dos dados pessoais e
              dados pessoais sensíveis de saúde de seus pacientes e colaboradores, e a
              CONTRATADA atua estritamente como Operadora, tratando os dados
              exclusivamente conforme as finalidades deste contrato.
            </p>

            <p>
              <strong className="font-semibold text-slate-950">
                2. Base Legal e Consentimento:
              </strong>{" "}
              Compete exclusivamente à CONTRATANTE assegurar base legal adequada para
              a coleta e inserção dos dados de pacientes no sistema, bem como atender
              às solicitações dos titulares de dados.
            </p>

            <p>
              <strong className="font-semibold text-slate-950">
                3. Medidas Técnicas de Segurança:
              </strong>{" "}
              A CONTRATADA adota medidas proporcionais à sensibilidade dos dados de
              saúde, incluindo isolamento em servidor e banco de dados exclusivos por
              clínica, criptografia em trânsito (HTTPS/TLS), controle restrito de
              acesso administrativo e rotina de backups diários criptografados.
            </p>

            <p>
              <strong className="font-semibold text-slate-950">
                4. Suboperadores:
              </strong>{" "}
              A CONTRATANTE autoriza a utilização de provedores de infraestrutura em
              nuvem/datacenter localizados no Brasil e serviços essenciais de
              armazenamento de backup, permanecendo a CONTRATADA responsável pela
              observância de padrões de segurança equivalentes.
            </p>

            <p>
              <strong className="font-semibold text-slate-950">
                5. Incidentes de Segurança:
              </strong>{" "}
              Em caso de incidente de segurança confirmado que possa acarretar risco
              ou dano relevante aos dados hospedados, a CONTRATADA comunicará a
              CONTRATANTE em até 48 (quarenta e oito) horas após a confirmação
              técnica, fornecendo as informações disponíveis para adoção das medidas
              cabíveis.
            </p>

            <p>
              <strong className="font-semibold text-slate-950">
                6. Eliminação:
              </strong>{" "}
              Encerrado o contrato, os dados serão devolvidos e eliminados na forma da
              Cláusula 7ª do Contrato Principal.
            </p>
          </div>

          <div className="contract-avoid-break pt-6">
            <p className="text-right text-xs font-medium text-slate-700">
              <Field value={v.FORO_CONTRATO} />, <Field value={v.DATA_CONTRATO} />.
            </p>
            <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2">
              <div className="text-center">
                <div className="mx-auto mb-2 w-full border-t border-slate-400" />
                <p className="text-[11px] font-bold tracking-wide text-slate-900 uppercase">
                  CONTRATADA (OPERADORA)
                </p>
                <p className="mt-0.5 text-[11px] text-slate-600">
                  <Field value={v.HQ_RAZAO_SOCIAL} />
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto mb-2 w-full border-t border-slate-400" />
                <p className="text-[11px] font-bold tracking-wide text-slate-900 uppercase">
                  CONTRATANTE (CONTROLADORA)
                </p>
                <p className="mt-0.5 text-[11px] text-slate-600">
                  <Field value={v.CLINICA_RAZAO_SOCIAL} />
                </p>
              </div>
            </div>
          </div>
        </section>
      </article>
    </div>
  );
}
