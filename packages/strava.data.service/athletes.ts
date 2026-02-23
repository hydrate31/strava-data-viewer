export default (folder: string) => ({
    list: async () => {
        const athletes = []
        for await (const dirEntry of Deno.readDir(`./data/${folder}/athletes/`)) {
            if (dirEntry.isFile) {
                const json = JSON.parse(await Deno.readTextFile(`./data/${folder}/athletes/${dirEntry.name}`));
                athletes.push(json);
            }
        }
        return athletes
    },
})
