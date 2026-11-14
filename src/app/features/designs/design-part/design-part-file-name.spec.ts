import { parseDesignPartFileName } from './design-part-file-name';

describe('parseDesignPartFileName', () => {
  it('parses assembly numbers, part number, and name from a design filename', () => {
    expect(parseDesignPartFileName('602-10100-01-A_Base Frame.pdf')).toEqual({
      partNumber: '602-10100-01-A',
      partName: 'Base Frame',
      mainAssemblyNumber: '602',
      subAssemblyNumber: '10100',
    });
  });

  it('preserves underscores and periods in the part name while removing the file extension', () => {
    expect(parseDesignPartFileName('602-10200-03-A_Fixture_Plate.Rev A.step')).toEqual({
      partNumber: '602-10200-03-A',
      partName: 'Fixture_Plate.Rev A',
      mainAssemblyNumber: '602',
      subAssemblyNumber: '10200',
    });
  });

  it('continues to parse legacy filenames without assembly numbers', () => {
    expect(parseDesignPartFileName('PART-01 Base Frame.pdf')).toEqual({
      partNumber: 'PART-01',
      partName: 'Base Frame',
      mainAssemblyNumber: null,
      subAssemblyNumber: null,
    });
  });

  it('rejects malformed assembly-prefixed filenames', () => {
    expect(parseDesignPartFileName('602-10100-01-A_.pdf')).toBeNull();
    expect(parseDesignPartFileName('602_partname.pdf')).toBeNull();
  });
});
