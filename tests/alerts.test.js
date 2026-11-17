// Alertes de l'équipe (src/lib/alerts.js), en mode démo.
import { describe, expect, it } from 'vitest';
import { getAlertsState, markAlertsRead, refreshAlerts } from '../src/lib/alerts.js';

describe('Alertes de l’équipe', () => {
  it('liste chargée, pastille des non lues, puis tout marqué lu', async () => {
    await refreshAlerts();
    const st = getAlertsState();
    expect(st.loaded).toBe(true);
    expect(st.alerts.length).toBeGreaterThan(0);
    expect(st.alerts.map((a) => a.kind)).toContain('signup');
    expect(st.unread).toBe(2);
    await markAlertsRead();
    expect(getAlertsState().unread).toBe(0);
    await refreshAlerts();
    expect(getAlertsState().unread).toBe(0); // reste lu au rechargement
  });
});
