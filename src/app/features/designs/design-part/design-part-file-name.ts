export interface ParsedDesignPartFileName {
  partNumber: string;
  partName: string;
  mainAssemblyNumber: string | null;
  subAssemblyNumber: string | null;
}

export function parseDesignPartFileName(fileName: string): ParsedDesignPartFileName | null {
  const extensionIndex = fileName.lastIndexOf('.');
  const baseName = extensionIndex > 0 ? fileName.slice(0, extensionIndex) : fileName;
  const separatorIndex = baseName.indexOf('_');

  if (separatorIndex > 0) {
    const partNumber = baseName.slice(0, separatorIndex).trim();
    const partName = baseName.slice(separatorIndex + 1).trim();
    const assemblyNumbers = /^([^-]+)-([^-]+)-.+$/.exec(partNumber);
    if (!assemblyNumbers || !partName) {
      return null;
    }
    return {
      partNumber,
      partName,
      mainAssemblyNumber: assemblyNumbers[1],
      subAssemblyNumber: assemblyNumbers[2],
    };
  }

  const legacyName = /^(\S+)(?:\s+(.+))?$/.exec(baseName.trim());
  if (!legacyName) {
    return null;
  }
  return {
    partNumber: legacyName[1],
    partName: legacyName[2]?.trim() ?? '',
    mainAssemblyNumber: null,
    subAssemblyNumber: null,
  };
}
