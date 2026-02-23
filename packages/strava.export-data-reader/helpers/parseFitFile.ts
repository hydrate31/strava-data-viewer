import FitParser from "npm:fit-file-parser"

export const parseFitFile = async (content: ArrayBuffer | Uint8Array): Promise<any> => {
    const payload = content instanceof Uint8Array
        ? new Uint8Array(content).buffer
        : content;

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
    
        fitParser.parse(payload, function (error, data) {
            // Handle result of parse method
            if (error) {
              reject(error)
            } else if (data) {
              resolve(data);
            } else {
              reject("FIT parser returned no data");
            }
        });
    })
}
