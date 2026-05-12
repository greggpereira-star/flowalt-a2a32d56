import { useEffect, useRef } from "react";
import { UseFormReturn } from "react-hook-form";

/**
 * Hook to persist form data in localStorage to prevent data loss when navigating.
 * @param form The react-hook-form instance
 * @param storageKey Unique key to store the data
 * @param enabled Whether persistence is enabled
 * @param onLoad Optional callback when data is loaded
 */
export function useFormPersistence<TFieldValues extends Record<string, any>>(
  form: UseFormReturn<TFieldValues>,
  storageKey: string,
  enabled: boolean = true,
  onLoad?: (data: TFieldValues) => void
) {
  const isLoadedRef = useRef(false);

  // Load initial data from localStorage
  useEffect(() => {
    if (!enabled) return;

    // Reset loaded state when storage key changes
    isLoadedRef.current = false;

    const savedData = localStorage.getItem(storageKey);
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        
        // Convert date strings back to Date objects if they look like ISO dates
        const revivedData = Object.entries(parsedData).reduce((acc, [key, value]) => {
          if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
            acc[key as keyof TFieldValues] = new Date(value) as any;
          } else {
            acc[key as keyof TFieldValues] = value as any;
          }
          return acc;
        }, {} as TFieldValues);

        // Update form values
        form.reset({
          ...form.getValues(),
          ...revivedData
        });
        
        if (onLoad) {
          onLoad(revivedData);
        }
        
        isLoadedRef.current = true;
      } catch (error) {
        console.error("Failed to load persisted form data:", error);
      }
    }
  }, [enabled, storageKey, form]); // Removed onLoad from deps to avoid re-runs if callback is not memoized

  // Save data to localStorage on change
  useEffect(() => {
    if (!enabled) return;

    const subscription = form.watch((value) => {
      localStorage.setItem(storageKey, JSON.stringify(value));
    });

    return () => subscription.unsubscribe();
  }, [form, storageKey, enabled]);

  // Function to clear storage (call this after successful submit)
  const clearPersistence = () => {
    localStorage.removeItem(storageKey);
    isLoadedRef.current = false;
  };

  return { clearPersistence };
}
