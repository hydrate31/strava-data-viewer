import { DOMParser, Element } from "jsr:@b-fuze/deno-dom";

export interface IAthlete {
    id: string;
    name: string;
    avatarUrl: string;
}

export default (folder: string) => ({
    get: async (athlete_id: string): Promise<IAthlete> => {
        const athelete_url = `https://www.strava.com/athletes/${athlete_id}`;
        const response = await fetch(athelete_url);
        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, "text/html");

        const title = doc.querySelector("title")?.textContent ?? "";
        const meta = doc.querySelector('meta[property="og:image"]');
        const avatar = meta?.attributes.getNamedItem("content")?.value ?? "";

        return {
            id: athlete_id,
            name: title.split(' | ')[0].replace("Signup for free to see more about ", ""),
            avatarUrl: avatar,
        }

    },
})