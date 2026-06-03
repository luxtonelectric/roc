import os
import sys

Docs_Path = 'docs/Panel Codes.md'
Simulations = 'server/simulations'

DocsCodes = ["Codes"] # Keep header same to avoid false errors
SimCodes = ["Codes"]
Errors = ["ErrorList:"]

def main():
    ImportDocsCodes()
    ImportJSONCodes()
    CompareCodes()
    
    for Error in Errors:
        print(Error)
        
    if len(Errors) > 1:
        sys.exit(1)
    else:
        sys.exit(0)

def ImportDocsCodes():
    with open(Docs_Path, 'r') as Document:
        for Line in Document:
            if Line[0] == '|' and not 'Code' in Line and not '--' in Line: # -- to avoid standard hyphens which would cause false errors
                Code = Line.split('|')[1].strip()
                if Code in DocsCodes:
                    Errors.append("Code '{0}' duplicated in docs!".format(Code))
                else:
                    DocsCodes.append(Code)

def ImportJSONCodes():
    for Filename in os.listdir(Simulations):
        with open(os.path.join(Simulations, Filename), 'r') as File:
            for Line in File:
                if '"code":' in Line: # Slightly cursed method of interpreting json files, but it works
                    Code = Line.replace(',', '').replace('"', '').strip().split(':')[1].strip()
                    if Code in SimCodes:
                        Errors.append("Code '{0}' duplicated in sims!".format(Code))
                    else:
                        SimCodes.append(Code)
    
def CompareCodes():
    for Code in DocsCodes:
        if not Code in SimCodes:
            Errors.append("Code '{0}' in docs codes not found in sim codes!".format(Code))
    for Code in SimCodes:
        if not Code in DocsCodes:
            Errors.append("Code '{0}' in sim codes not found in docs codes!".format(Code))

if __name__ == '__main__':
    main()
