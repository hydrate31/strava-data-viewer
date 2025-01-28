export const fileExists = async (filename: string): Promise<boolean> => {
    try {
        await Deno.stat(filename);
        // successful, file or directory must exist
        return true;
    } catch (error: any) {
        if (error) {
            // file or directory does not exist
            return false;
        } else {
            // unexpected error, maybe permissions, pass it along
            throw error;
        }
    }
}
