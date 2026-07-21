"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImageDropzone } from "./components/ImageDropzone";
import { StatusPanel } from "./components/StatusPanel";
import { ResultPanel } from "./components/ResultPanel";
import { SearchableSelect } from "./components/SearchableSelect";
import { SUPPORTED_LANGUAGES, getLanguageByCode } from "@/lib/languages";
import { estimateSpeechDurationSeconds } from "@/lib/script";
import type {
  AvatarOption,
  VoiceOption,
  VideoFormat,
  ProductDisplayMode,
  AvatarMode,
  GenerateVideoResponse,
  VideoStatusResponse,
} from "@/lib/types";

const inputClass =
  "rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-400 focus:outline-none";
const labelClass = "text-sm font-medium text-neutral-200";
const sectionClass = "flex flex-col gap-4 rounded-lg border border-neutral-800 bg-neutral-950 p-5";

const POLL_INTERVAL_MS = 4000;

export default function Home() {
  // Produto
  const [productName, setProductName] = useState("");
  const [productImage, setProductImage] = useState<File | null>(null);
  const [copy, setCopy] = useState("");

  // Vídeo
  const [durationMinutes, setDurationMinutes] = useState("0.5");
  const [language, setLanguage] = useState("pt");
  const [format, setFormat] = useState<VideoFormat>("9:16");
  const [captions, setCaptions] = useState(true);

  // Avatar
  const [avatarMode, setAvatarMode] = useState<AvatarMode>("existing");
  const [avatarId, setAvatarId] = useState("");
  const [avatarImage, setAvatarImage] = useState<File | null>(null);
  const [voiceId, setVoiceId] = useState("");

  // Comportamento
  const [behaviorNotes, setBehaviorNotes] = useState("");
  const [tone, setTone] = useState("");
  const [facialExpressions, setFacialExpressions] = useState("");
  const [gestures, setGestures] = useState("");

  // Cenário e produto na cena
  const [scenario, setScenario] = useState("");
  const [backgroundImage, setBackgroundImage] = useState<File | null>(null);
  const [backgroundColor, setBackgroundColor] = useState("#f5f5f5");
  const [productDisplayMode, setProductDisplayMode] =
    useState<ProductDisplayMode>("product_background");

  // Catálogo HeyGen
  const [avatars, setAvatars] = useState<AvatarOption[]>([]);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Estado de submissão
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [generateResult, setGenerateResult] = useState<GenerateVideoResponse | null>(null);
  const [videoStatus, setVideoStatus] = useState<VideoStatusResponse | null>(null);
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  useEffect(() => {
    async function loadCatalog() {
      try {
        const [avatarsRes, voicesRes] = await Promise.all([
          fetch("/api/avatars"),
          fetch("/api/voices"),
        ]);
        if (!avatarsRes.ok || !voicesRes.ok) {
          throw new Error("Falha ao carregar catálogo");
        }
        const avatarsBody = (await avatarsRes.json()) as { avatars: AvatarOption[] };
        const voicesBody = (await voicesRes.json()) as { voices: VoiceOption[] };
        setAvatars(avatarsBody.avatars);
        setVoices(voicesBody.voices);
      } catch {
        setCatalogError(
          "Não foi possível carregar avatares/vozes da HeyGen. Verifique a HEYGEN_API_KEY configurada no servidor.",
        );
      } finally {
        setCatalogLoading(false);
      }
    }
    loadCatalog();
  }, []);

  // Polling do status do vídeo
  useEffect(() => {
    if (!generateResult) return;
    if (videoStatus?.status === "completed" || videoStatus?.status === "failed") return;

    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/status/${generateResult.videoId}`);
        const body = (await res.json()) as VideoStatusResponse;
        if (!cancelled) setVideoStatus(body);
      } catch {
        // ignora falha pontual de polling, tenta novamente no próximo tick
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [generateResult, videoStatus?.status]);

  const filteredVoices = useMemo(() => {
    const languageLabel = getLanguageByCode(language).label.split(" ")[0].toLowerCase();
    const matches = voices.filter((v) => v.language?.toLowerCase().includes(languageLabel));
    return matches.length > 0 ? matches : voices;
  }, [voices, language]);

  const durationEstimate = useMemo(() => {
    if (!copy.trim()) return null;
    const minutes = Number.parseFloat(durationMinutes);
    if (!Number.isFinite(minutes) || minutes <= 0) return null;
    const lang = getLanguageByCode(language);
    const estimatedSeconds = estimateSpeechDurationSeconds(copy, lang.wordsPerMinute);
    return { estimatedSeconds, requestedSeconds: minutes * 60 };
  }, [copy, durationMinutes, language]);

  function resetForNewGeneration() {
    idempotencyKeyRef.current = crypto.randomUUID();
    setGenerateResult(null);
    setVideoStatus(null);
    setFormError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!productImage) {
      setFormError("Envie a imagem real do produto.");
      return;
    }
    if (!copy.trim()) {
      setFormError("Informe a copy que o avatar deve falar.");
      return;
    }
    if (avatarMode === "existing" && !avatarId) {
      setFormError("Selecione um avatar existente.");
      return;
    }
    if (avatarMode === "upload" && !avatarImage) {
      setFormError("Envie uma imagem para criação do avatar.");
      return;
    }
    if (!voiceId) {
      setFormError("Selecione uma voz.");
      return;
    }

    setSubmitting(true);
    try {
      const body = new FormData();
      body.set("productName", productName);
      body.set("copy", copy);
      body.set("durationMinutes", durationMinutes);
      body.set("language", language);
      body.set("voiceId", voiceId);
      body.set("format", format);
      body.set("avatarMode", avatarMode);
      if (avatarId) body.set("avatarId", avatarId);
      if (behaviorNotes) body.set("behaviorNotes", behaviorNotes);
      if (tone) body.set("tone", tone);
      if (facialExpressions) body.set("facialExpressions", facialExpressions);
      if (gestures) body.set("gestures", gestures);
      if (scenario) body.set("scenario", scenario);
      body.set("backgroundColor", backgroundColor);
      body.set("productDisplayMode", productDisplayMode);
      body.set("captions", String(captions));
      body.set("idempotencyKey", idempotencyKeyRef.current);
      body.set("productImage", productImage);
      if (avatarImage) body.set("avatarImage", avatarImage);
      if (backgroundImage) body.set("backgroundImage", backgroundImage);

      const res = await fetch("/api/generate", { method: "POST", body });
      const responseBody = await res.json();
      if (!res.ok) {
        setFormError(responseBody.error ?? "Falha ao gerar o vídeo.");
        return;
      }
      setGenerateResult(responseBody as GenerateVideoResponse);
      setVideoStatus({ status: "pending", videoUrl: null, thumbnailUrl: null, durationSeconds: null, error: null });
    } catch {
      setFormError("Erro de rede ao enviar a requisição. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  const isGenerating =
    generateResult && videoStatus && videoStatus.status !== "completed" && videoStatus.status !== "failed";

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10 text-neutral-100">
      <header>
        <h1 className="text-2xl font-semibold">Gerador de Vídeos Publicitários com Avatar IA</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Preencha os dados do produto e do avatar para gerar automaticamente um vídeo publicitário via HeyGen.
        </p>
      </header>

      {catalogError && (
        <p className="rounded-md border border-red-800 bg-red-950 p-3 text-sm text-red-300">
          {catalogError}
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <section className={sectionClass}>
          <h2 className="font-medium text-neutral-100">Produto</h2>
          <div className="flex flex-col gap-2">
            <label className={labelClass}>
              Nome do produto <span className="text-red-400">*</span>
            </label>
            <input
              className={inputClass}
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Ex.: Sérum Facial Vitamina C"
              required
            />
          </div>
          <ImageDropzone
            label="Imagem real do produto"
            required
            hint="PNG, JPG/JPEG ou WebP, até 10MB. A embalagem, cores, logotipo e rótulo reais serão preservados."
            file={productImage}
            onChange={setProductImage}
          />
          <div className="flex flex-col gap-2">
            <label className={labelClass}>
              Copy completa que o avatar deverá falar <span className="text-red-400">*</span>
            </label>
            <textarea
              className={`${inputClass} min-h-32`}
              value={copy}
              onChange={(e) => setCopy(e.target.value)}
              placeholder="Digite o roteiro completo, exatamente como deve ser falado…"
              required
            />
          </div>
        </section>

        <section className={sectionClass}>
          <h2 className="font-medium text-neutral-100">Configurações do vídeo</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className={labelClass}>Duração desejada (minutos)</label>
              <input
                type="number"
                min="0.1"
                max="30"
                step="0.1"
                className={inputClass}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className={labelClass}>Idioma</label>
              <select className={inputClass} value={language} onChange={(e) => setLanguage(e.target.value)}>
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className={labelClass}>Formato do vídeo</label>
              <select
                className={inputClass}
                value={format}
                onChange={(e) => setFormat(e.target.value as VideoFormat)}
              >
                <option value="9:16">9:16 (vertical)</option>
                <option value="16:9">16:9 (horizontal)</option>
                <option value="1:1">1:1 (quadrado)</option>
              </select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                id="captions"
                type="checkbox"
                checked={captions}
                onChange={(e) => setCaptions(e.target.checked)}
              />
              <label htmlFor="captions" className={labelClass}>
                Adicionar legendas
              </label>
            </div>
          </div>

          {durationEstimate && (
            <div className="rounded-md border border-neutral-700 bg-neutral-900 p-3 text-xs text-neutral-300">
              <p>
                Estimativa com base na copy: duração de fala de aproximadamente{" "}
                <strong>{Math.round(durationEstimate.estimatedSeconds)}s</strong> (você pediu{" "}
                {Math.round(durationEstimate.requestedSeconds)}s).
              </p>
              {Math.abs(durationEstimate.estimatedSeconds - durationEstimate.requestedSeconds) >
                durationEstimate.requestedSeconds * 0.2 && (
                <p className="mt-1 text-yellow-400">
                  A API da HeyGen usada aqui não permite ajustar a velocidade da voz — a duração final do vídeo
                  depende do ritmo natural da voz escolhida. Ajuste o tamanho da copy se quiser aproximar a
                  duração desejada.
                </p>
              )}
            </div>
          )}
        </section>

        <section className={sectionClass}>
          <h2 className="font-medium text-neutral-100">Avatar</h2>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={avatarMode === "existing"}
                onChange={() => setAvatarMode("existing")}
              />
              Usar avatar existente
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={avatarMode === "upload"}
                onChange={() => setAvatarMode("upload")}
              />
              Criar avatar a partir de imagem
            </label>
          </div>

          {avatarMode === "existing" ? (
            <div className="flex flex-col gap-2">
              <label className={labelClass}>Avatar</label>
              <SearchableSelect
                value={avatarId}
                onChange={setAvatarId}
                disabled={catalogLoading}
                placeholder={catalogLoading ? "Carregando avatares…" : "Selecione um avatar"}
                emptyLabel="Nenhum avatar encontrado."
                options={avatars.map((a) => ({
                  value: a.avatarId,
                  label: a.name,
                  sublabel: a.gender,
                  imageUrl: a.previewImageUrl,
                }))}
              />
            </div>
          ) : (
            <ImageDropzone
              label="Imagem para criação do avatar"
              required
              hint="Foto nítida de rosto, PNG/JPG/WebP, até 10MB."
              file={avatarImage}
              onChange={setAvatarImage}
            />
          )}

          <div className="flex flex-col gap-2">
            <label className={labelClass}>Voz</label>
            <SearchableSelect
              value={voiceId}
              onChange={setVoiceId}
              disabled={catalogLoading}
              placeholder={catalogLoading ? "Carregando vozes…" : "Selecione uma voz"}
              emptyLabel="Nenhuma voz encontrada."
              options={filteredVoices.map((v) => ({
                value: v.voiceId,
                label: `${v.name} (${v.language}${v.gender ? `, ${v.gender}` : ""})`,
                sublabel: v.language,
              }))}
            />
          </div>
        </section>

        <section className={sectionClass}>
          <h2 className="font-medium text-neutral-100">Comportamento e apresentação do produto</h2>
          <div className="flex flex-col gap-2">
            <label className={labelClass}>Orientações de comportamento do avatar</label>
            <textarea
              className={inputClass}
              value={behaviorNotes}
              onChange={(e) => setBehaviorNotes(e.target.value)}
              placeholder="Ex.: falar com entusiasmo, olhar diretamente para a câmera…"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-2">
              <label className={labelClass}>Tom de voz</label>
              <input
                className={inputClass}
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                placeholder="Ex.: confiante"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className={labelClass}>Expressões faciais</label>
              <input
                className={inputClass}
                value={facialExpressions}
                onChange={(e) => setFacialExpressions(e.target.value)}
                placeholder="Ex.: sorriso leve"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className={labelClass}>Movimentos e gestos</label>
              <input
                className={inputClass}
                value={gestures}
                onChange={(e) => setGestures(e.target.value)}
                placeholder="Ex.: acenar com a mão"
              />
            </div>
          </div>
          <p className="text-xs text-neutral-500">
            Essas orientações são registradas e exibidas no resumo do vídeo. A API de geração de vídeo da HeyGen
            usada aqui (v3/videos) não expõe controle direto de tom, expressão facial, gestos ou velocidade da
            voz — apenas avatar, voz e cenário são efetivamente configuráveis via API.
          </p>

          <div className="flex flex-col gap-2">
            <label className={labelClass}>Cenário ou fundo desejado (descrição)</label>
            <input
              className={inputClass}
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              placeholder="Ex.: cozinha moderna, estúdio branco…"
            />
          </div>
          <ImageDropzone
            label="Imagem de cenário/fundo (opcional)"
            hint="Se enviada, será usada como plano de fundo das cenas em que o produto não estiver em destaque."
            file={backgroundImage}
            onChange={setBackgroundImage}
          />
          {!backgroundImage && (
            <div className="flex flex-col gap-2">
              <label className={labelClass}>Cor de fundo (se nenhuma imagem de cenário for enviada)</label>
              <input
                type="color"
                className="h-10 w-20 rounded-md border border-neutral-700 bg-neutral-900"
                value={backgroundColor}
                onChange={(e) => setBackgroundColor(e.target.value)}
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label className={labelClass}>Como o produto será apresentado</label>
            <select
              className={inputClass}
              value={productDisplayMode}
              onChange={(e) => setProductDisplayMode(e.target.value as ProductDisplayMode)}
            >
              <option value="product_background">Produto como plano de fundo do vídeo</option>
              <option value="scenario_background">Cenário/cor como fundo (produto só citado na fala)</option>
            </select>
            <p className="text-xs text-neutral-500">
              A API de geração de vídeo da HeyGen usada aqui gera uma única cena por vídeo, com um único plano de
              fundo (cor ou imagem) — não é possível compor o produto fisicamente na mão do avatar, ao lado dele,
              ou alterná-lo em momentos específicos do vídeo. Por isso, a imagem real do produto é usada como o
              próprio plano de fundo do vídeo quando esta opção é selecionada (os avatares deste catálogo suportam
              substituição real do fundo, testado na prática). Para composição avançada, seria necessário treinar
              um avatar personalizado no HeyGen Studio.
            </p>
          </div>
        </section>

        {formError && (
          <p className="rounded-md border border-red-800 bg-red-950 p-3 text-sm text-red-300">{formError}</p>
        )}

        <button
          type="submit"
          disabled={submitting || catalogLoading || Boolean(isGenerating)}
          className="rounded-md bg-white px-4 py-3 font-medium text-black hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Enviando…" : "Gerar vídeo"}
        </button>
      </form>

      {generateResult && videoStatus && (
        <section className="flex flex-col gap-4">
          <h2 className="font-medium text-neutral-100">Acompanhamento</h2>
          <StatusPanel status={videoStatus} />
          {videoStatus.status === "completed" && videoStatus.videoUrl && (
            <ResultPanel
              videoUrl={videoStatus.videoUrl}
              durationSeconds={videoStatus.durationSeconds}
              format={format}
              onRegenerate={resetForNewGeneration}
            />
          )}
          {videoStatus.status === "failed" && (
            <button
              type="button"
              onClick={resetForNewGeneration}
              className="self-start rounded-md border border-neutral-600 px-4 py-2 text-sm font-medium text-neutral-200 hover:border-neutral-400"
            >
              Tentar novamente
            </button>
          )}
        </section>
      )}
    </main>
  );
}
