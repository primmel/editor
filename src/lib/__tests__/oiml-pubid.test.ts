// ─────────────────────────────────────────────────────────────────────
// TODO.editor/38 — the OIML pubid parser's proofs: the grammar per
// family, the optional parts, the rejections, and the URN convention.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { parseOimlPubid, urnForOimlPubid } from '../oiml-pubid';

describe('38 — the OIML pubid parser', () => {
  it('the publication families (R, B, D, G, E, V)', () => {
    expect(parseOimlPubid('OIML R 60-2:2021')).toMatchObject({
      series: 'pub', family: 'r', number: '60', part: '2', year: '2021',
    });
    expect(parseOimlPubid('OIML R 60')).toMatchObject({ series: 'pub', family: 'r', number: '60' });
    expect(parseOimlPubid('OIML B 18:2025(E)')).toMatchObject({
      series: 'pub', family: 'b', number: '18', year: '2025',
    });
    expect(parseOimlPubid('OIML D 11:2013')).toMatchObject({ series: 'pub', family: 'd', number: '11', year: '2013' });
    expect(parseOimlPubid('OIML G 21:2017')).toMatchObject({ series: 'pub', family: 'g', number: '21', year: '2017' });
    expect(parseOimlPubid('OIML E 6:2011')).toMatchObject({ series: 'pub', family: 'e', number: '6', year: '2011' });
  });

  it('the year comes from the bibdata when the identifier omits it', () => {
    expect(parseOimlPubid('OIML R 7', '1979')).toMatchObject({ family: 'r', number: '7', year: '1979' });
  });

  it('the CS family (PD/OD/CID) with editions and amendments', () => {
    expect(parseOimlPubid('OIML-CS PD-05 Edition 6 (Amendment 1)', '2024')).toMatchObject({
      series: 'cs', family: 'pd', number: '05', edition: '6', amendment: '1', year: '2024',
    });
    expect(parseOimlPubid('OIML-CS OD-01 Edition 4', '2024')).toMatchObject({
      series: 'cs', family: 'od', number: '01', edition: '4', year: '2024',
    });
    expect(parseOimlPubid('OIML-CS CID-01 Edition 6')).toMatchObject({
      series: 'cs', family: 'cid', number: '01', edition: '6',
    });
    // The CS hyphen and spacing variants both parse.
    expect(parseOimlPubid('OIML-CS PD 05 Edition 6')).toMatchObject({ series: 'cs', family: 'pd', number: '05' });
  });

  it('rejects non-OIML shapes (the caller falls back to the slug)', () => {
    expect(parseOimlPubid('Some Other Document')).toBeNull();
    expect(parseOimlPubid('OIML X 99')).toBeNull();
    expect(parseOimlPubid('OIML R 60 extra words here')).toBeNull();
    expect(parseOimlPubid('OIML-CS XX-01 Edition 1')).toBeNull();
  });

  it('the URN convention composes from the structure', () => {
    expect(urnForOimlPubid(parseOimlPubid('OIML R 60-2:2021')!)).toBe('urn:oiml:pub:r:60-2:2021');
    expect(urnForOimlPubid(parseOimlPubid('OIML B 18:2025(E)')!)).toBe('urn:oiml:pub:b:18:2025');
    expect(urnForOimlPubid(parseOimlPubid('OIML R 7', '1979')!)).toBe('urn:oiml:pub:r:7:1979');
    expect(urnForOimlPubid(parseOimlPubid('OIML-CS PD-05 Edition 6 (Amendment 1)', '2024')!))
      .toBe('urn:oiml:pub:cs:pd-05:2024');
    expect(urnForOimlPubid(parseOimlPubid('OIML-CS OD-01 Edition 4', '2024')!))
      .toBe('urn:oiml:pub:cs:od-01:2024');
  });
});
