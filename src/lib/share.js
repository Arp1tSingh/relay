export function canShare() {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

export async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.appendChild(field);
  field.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(field);
  if (!copied) throw new Error('Copying is not available in this browser.');
}

export async function shareOrCopy({ title, text }) {
  if (canShare()) {
    await navigator.share({ title, text });
    return 'shared';
  }
  await copyText(text);
  return 'copied';
}