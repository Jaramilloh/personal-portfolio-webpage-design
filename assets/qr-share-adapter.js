export class QrShareAdapter {
  constructor(api = globalThis.QRShare) { this._api = api; }
  mount({ url, name, role } = {}) { this._api?.init?.({ url, name, role }); }
  open()   { this._api?.open?.(); }
  close()  { this._api?.close?.(); }
  toggle() { this._api?.toggle?.(); }
}
