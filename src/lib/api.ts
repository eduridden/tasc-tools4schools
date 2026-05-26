
import { getFunctions, httpsCallable } from "firebase/functions";
import { getApp } from "firebase/app";

// Helper to get functions instance (assuming app is initialized)
const getFunctionsInstance = () => getFunctions(getApp());

export async function interpretSearchQuery(input: any) {
    const fn = httpsCallable(getFunctionsInstance(), 'interpretSearchQuery');
    const result = await fn(input);
    return result.data as any;
}

export async function suggestIcon(input: any) {
    const fn = httpsCallable(getFunctionsInstance(), 'suggestIcon');
    const result = await fn(input);
    return result.data as string;
}

export async function aiSearch(input: any) {
    const fn = httpsCallable(getFunctionsInstance(), 'aiSearch');
    const result = await fn(input);
    return result.data as any; // AiSearchOutput
}

export async function submitTool(data: any) {
    const fn = httpsCallable(getFunctionsInstance(), 'submitTool');
    const result = await fn(data);
    return result.data;
}

export async function generateClassroomIdeas(input: any) {
    const fn = httpsCallable(getFunctionsInstance(), 'generateClassroomIdeas');
    const result = await fn(input);
    return result.data as any;
}

export async function generateToolGuide(input: any) {
    const fn = httpsCallable(getFunctionsInstance(), 'generateToolGuide');
    const result = await fn(input);
    return result.data as any;
}

export async function vetTool(input: any) {
    const fn = httpsCallable(getFunctionsInstance(), 'vetTool');
    const result = await fn(input);
    return result.data as any;
}

export async function findLogo(toolUrl: string) {
    const fn = httpsCallable(getFunctionsInstance(), 'findLogo');
    const result = await fn({ toolUrl });
    return result.data as string | null;
}
