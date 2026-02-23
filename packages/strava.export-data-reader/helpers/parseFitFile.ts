import FitParser from "npm:fit-file-parser"

export const parseFitFile = async (content: ArrayBuffer | Uint8Array): Promise<object> => {
    return new Promise((resolve, reject) => {
        const fitParser = new FitParser({
            force: true,
            speedUnit: 'km/h',
            lengthUnit: 'km',
            temperatureUnit: 'kelvin',
            pressureUnit: 'bar', // accept bar, cbar and psi (default is bar)
            elapsedRecordField: true,
            mode: 'cascade',
        });
    
        fitParser.parse(content, function (error: any, data: Object) {
            // Handle result of parse method
            if (error) {
              reject(error)
            } else {
              resolve(data);
            }
        });
    })
}
