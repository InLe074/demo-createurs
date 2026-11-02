// Ce connecteur est exclusivement local et fictif. Aucun endpoint Storable n'est appelé.
export class MockConnector {
  constructor(server) {this.server = server; this.mode = 'simulation';}
  readSnapshot() {return structuredClone({invoices: this.server.invoices, revision: this.server.revision});}
  findReceipt(operationId) {return structuredClone(this.server.receipts.find(r => r.operationId === operationId) || null);}
  recordExternalPayment(request) {
    const prior = this.findReceipt(request.operationId);
    if (prior) {
      if (prior.invoiceId !== request.invoiceId || prior.amountCents !== request.amountCents || prior.currency !== request.currency) throw new Error('Identifiant réutilisé pour un autre règlement.');
      return prior;
    }
    const invoice = this.server.invoices.find(i => i.id === request.invoiceId);
    if (!invoice || invoice.currency !== request.currency) throw new Error('Facture ou devise incompatible dans le système simulé.');
    if (!Number.isSafeInteger(request.amountCents) || request.amountCents <= 0 || request.amountCents > invoice.balanceCents) throw new Error('Le solde du système simulé a changé. Actualisez le dossier.');
    invoice.balanceCents -= request.amountCents;
    const receipt = {operationId: request.operationId, receiptId: 'RECU-DEMO-' + (this.server.receipts.length + 1), invoiceId: request.invoiceId, amountCents: request.amountCents, currency: request.currency, date: request.date};
    this.server.receipts.push(receipt); this.server.revision++;
    return structuredClone(receipt);
  }
}
