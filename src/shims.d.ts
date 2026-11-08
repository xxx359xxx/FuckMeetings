declare module "mammoth" {
  export interface MammothMessage {
    type: string;
    message: string;
  }
  export interface MammothResult<T = string> {
    value: T;
    messages: MammothMessage[];
  }
  export function extractRawText(input: {
    arrayBuffer: ArrayBuffer;
  }): Promise<MammothResult<string>>;
  const mammoth: {
    extractRawText: typeof extractRawText;
  };
  export default mammoth;
}
