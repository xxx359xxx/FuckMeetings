import { create } from "zustand";

type UpdateGate = { meetingActive: boolean; meetingData: boolean; installing: boolean };
export const useUpdateGate = create<UpdateGate>(() => ({ meetingActive: false, meetingData: false, installing: false }));
