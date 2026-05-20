import qrcode from 'qrcode-terminal';

export function renderQr(url: string): string {
  let output = '';
  qrcode.generate(url, { small: true }, (rendered) => {
    output = rendered;
  });
  return output;
}
