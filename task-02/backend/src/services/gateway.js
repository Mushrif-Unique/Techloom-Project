// Pure, deterministic simulation: no card values are retained and there are no remote effects.
export function scenarioFor(cardNumber) {
  return {
    4242424242424242: 'SUCCESS',
    4000000000000002: 'FAILED',
    4000000000009995: 'TIMEOUT',
    4000000000009987: 'ORDER_FAILURE',
  }[cardNumber];
}
export function charge(scenario, paymentId) {
  // Fulfilment fails only after this scenario's successful mock charge.
  if (scenario === 'ORDER_FAILURE') scenario = 'SUCCESS';
  return {
    status: scenario,
    transactionReference: scenario === 'SUCCESS' ? `mock_${paymentId}` : null,
    failureReason:
      scenario === 'FAILED'
        ? 'The mock bank declined this payment.'
        : scenario === 'TIMEOUT'
          ? 'Gateway response unknown. Reconcile this attempt before starting another checkout.'
          : null,
  };
}
export function refund(payment) {
  return { status: 'SUCCESS', amount: payment.amount, processedAt: new Date() };
}
