import { useEffect } from "react";
import { UseFormReturn } from "react-hook-form";

/**
 * Hook to persist form data in localStorage to prevent data loss when navigating.
 * @param form The react-hook-form instance
 * @param storageKey Unique key to store the data
 * @param enabled Whether persistence is enabled
 */
export function useFormPersistence<TFieldValues extends Record<string, any>>(
  form: UseFormReturn<TFieldValues>,
  storageKey: string,
  enabled: boolean = true,
  onLoad?: (data: TFieldValues) => void
) {
  // Load initial data from localStorage
  useEffect(() => {
    if (!enabled) return;

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

        // Update form values. Using reset with current values merged with saved data
        // to keep default values for fields not in storage
        form.reset({
          ...form.getValues(),
          ...revivedData
        });
        
        if (onLoad) {
          onLoad(revivedData);
        }
      } catch (error) {
        console.error("Failed to load persisted form data:", error);
      }
    }
  }, [enabled, storageKey]); // Only on mount or if key changes

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
  };

  return { clearPersistence };
}
