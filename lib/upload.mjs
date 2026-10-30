export function uploadFileNames(format) {
  return ['final.mp4', 'cover.png', 'title.txt', 'description.txt', 'caption.txt',
    ...(format === 'landscape' ? ['thumbnail.png'] : [])];
}

export function uploadTextFiles(metadata) {
  const description = metadata.description ?? '';
  const tags = [...new Set((metadata.socialCaption ?? '').match(/#[A-Za-z0-9_]+/g) ?? [])];
  const present = new Set(description.match(/#[A-Za-z0-9_]+/g) ?? []);
  const missing = tags.filter((tag) => !present.has(tag));
  return {
    'title.txt': metadata.title + '\n',
    'description.txt': (missing.length ? `${description.trimEnd()}\n\n${missing.join(' ')}` : description) + '\n',
    'caption.txt': metadata.socialCaption + '\n',
    'pinned-comment.txt': metadata.pinnedComment + '\n',
    'upload-instructions.txt': [
      'Upload final.mp4 after full listening and device review.',
      'Instagram / vertical feeds: paste caption.txt and select cover.png in the cover editor.',
      'YouTube: use title.txt and description.txt; use thumbnail.png for landscape when present.',
      'Cover selection controls vary by platform and upload method. MP4 files do not automatically apply a separate cover.',
      'Captions are already burned into the video. SRT/VTT sidecars are included for optional platform captions.',
      'Use pinned-comment.txt after publishing. No account is connected and no upload is automated.',
      '',
    ].join('\n'),
  };
}
