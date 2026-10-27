/** Fetch compressed model parts in order without retaining all compressed parts. */
export async function downloadModel(entry, baseUrl, fetchImpl = fetch) {
  let index = 0;
  const compressed = new ReadableStream({
    async pull(controller) {
      if (index === entry.parts.length) return controller.close();
      try {
        const response = await fetchImpl(new URL(entry.parts[index++], baseUrl));
        if (!response.ok) throw new Error(`模型下载失败 (${response.status})`);
        controller.enqueue(new Uint8Array(await response.arrayBuffer()));
      } catch (error) { controller.error(error); }
    },
  });
  const buffer = await new Response(compressed.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  if (buffer.byteLength !== entry.bytes) throw new Error('模型文件不完整，请刷新重试');
  return buffer;
}
