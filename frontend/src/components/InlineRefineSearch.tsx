import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Accessibility,
  Baby,
  Briefcase,
  Building,
  DollarSign,
  FileText,
  Flag,
  GraduationCap,
  Heart,
  Home,
  MapPin,
  Scale,
  Shield,
  Sparkles,
  Stethoscope,
  Users,
  Utensils,
  Car,
  Lightbulb,
  Search,
  X,
} from "lucide-react";
import { resourceCategories } from "@/components/ClientDetailsInput";

interface InlineRefineSearchProps {
  initialQuery: string;
  initialCategories: string[];
  initialResourceTypes: string[];
  initialLocation: string;
  isLoading?: boolean;
  onRefineSearch: (
    query: string,
    categories: string[],
    resourceTypes: string[],
    location: string
  ) => void;
}

// Sub-categories for Local Community Resources
const communitySubcategories = [
  { id: "food", label: "Food & Nutrition", description: "Food banks, meal programs, SNAP enrollment", icon: Utensils },
  { id: "housing", label: "Housing & Shelter", description: "Emergency shelter, rental assistance, utilities", icon: Home },
  { id: "healthcare", label: "Healthcare Services", description: "Clinics, mental health, dental care", icon: Stethoscope },
  { id: "transportation", label: "Transportation", description: "Bus passes, rides, gas assistance", icon: Car },
  { id: "childcare", label: "Child Care & Education", description: "Daycare, after-school programs", icon: Baby },
  { id: "legal", label: "Legal Services", description: "Legal aid, immigration assistance", icon: Scale },
  { id: "financial", label: "Financial Assistance", description: "Cash assistance, bill payment help", icon: DollarSign },
  { id: "clothing", label: "Clothing & Household", description: "Clothing closets, furniture, household items", icon: Home },
  { id: "employment", label: "Employment Support", description: "Job search help, resume assistance", icon: Briefcase },
];

// Resource provider types
const resourceProviderTypes = [
  { id: "goodwill", label: "Goodwill Resources & Programs", description: "Job training, career services, and Goodwill-specific programs", icon: Heart },
  { id: "community", label: "Local Community Resources", description: "Food banks, shelters, community organizations, and local support", icon: Users },
  { id: "government", label: "Government Benefits", description: "SNAP, Medicaid, housing assistance, and federal/state programs", icon: Building },
];

// Additional resource types
const additionalResourceTypes = [
  { id: "job-postings", label: "Job Postings", description: "Current job openings, employment opportunities, and hiring events", icon: Briefcase },
  { id: "gcta", label: "GCTA Trainings", description: "Goodwill Career Training Academy programs and certifications", icon: GraduationCap },
  { id: "cat", label: "CAT Trainings", description: "Career Advancement Training and specialized skill development", icon: GraduationCap },
];

export function InlineRefineSearch({
  initialQuery,
  initialCategories,
  initialResourceTypes,
  initialLocation,
  isLoading = false,
  onRefineSearch,
}: InlineRefineSearchProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initialCategories);
  const [selectedResourceTypes, setSelectedResourceTypes] = useState<string[]>(initialResourceTypes);
  const [location, setLocation] = useState(initialLocation);
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);

  // Reset state when props change (new search)
  useEffect(() => {
    if (!isEditing) {
      setQuery(initialQuery);
      setSelectedCategories(initialCategories);
      setSelectedResourceTypes(initialResourceTypes);
      setLocation(initialLocation);
      setSelectedSubcategories([]);
    }
  }, [initialQuery, initialCategories, initialResourceTypes, initialLocation, isEditing]);

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const toggleResourceType = (type: string) => {
    setSelectedResourceTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const toggleSubcategory = (subcategoryId: string) => {
    setSelectedSubcategories((prev) =>
      prev.includes(subcategoryId)
        ? prev.filter((id) => id !== subcategoryId)
        : [...prev, subcategoryId]
    );
  };

  const handleSubmit = () => {
    // Combine selected categories and subcategories
    const allCategories = [...selectedCategories, ...selectedSubcategories];
    onRefineSearch(query, allCategories, selectedResourceTypes, location);
    setIsEditing(false);
  };

  const handleCancel = () => {
    // Reset to original values
    setQuery(initialQuery);
    setSelectedCategories(initialCategories);
    setSelectedResourceTypes(initialResourceTypes);
    setLocation(initialLocation);
    setSelectedSubcategories([]);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      handleSubmit();
    }
  };

  // Check if values have changed from initial
  const hasChanges =
    query !== initialQuery ||
    selectedCategories.length !== initialCategories.length ||
    selectedResourceTypes.length !== initialResourceTypes.length ||
    location !== initialLocation ||
    selectedSubcategories.length > 0;

  // Show loading state when searching
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="bg-white rounded-lg border-2 border-gray-200 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <Search className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" aria-hidden="true" />
            <div className="flex-1">
              <label className="text-sm font-semibold text-gray-700 block mb-1">You searched for:</label>
              <h2 className="text-lg font-medium text-gray-900" role="status" aria-label="Current search query">{initialQuery}</h2>

              {/* Active Filters Display */}
              {(initialCategories.length > 0 || initialResourceTypes.length > 0 || initialLocation) && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                    <FileText className="w-4 h-4" aria-hidden="true" />
                    <span className="font-medium">Active Filters:</span>
                  </div>

                  <div className="text-sm text-gray-700">
                    {initialResourceTypes.length > 0 && (
                      <div>
                        <span className="font-medium">Categories:</span>{" "}
                        {initialResourceTypes.map(type => {
                          const resourceType = [...resourceProviderTypes, ...additionalResourceTypes].find(t => t.id === type);
                          return resourceType?.label;
                        }).filter(Boolean).join(", ")}
                      </div>
                    )}
                    {initialCategories.length > 0 && (
                      <div className="mt-1">
                        <span className="font-medium">Resources:</span>{" "}
                        {initialCategories.map(categoryId => {
                          const category = resourceCategories.find((c) => c.id === categoryId);
                          return category?.label;
                        }).filter(Boolean).join(", ")}
                      </div>
                    )}
                    {initialLocation && (
                      <div className="mt-1">
                        <span className="font-medium">Location:</span> {initialLocation}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Loading State */}
        <div className="bg-blue-50 rounded-lg p-6 text-center border border-blue-200">
          <div className="flex justify-center items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent"></div>
            <p className="text-blue-800 font-medium">Searching for resources...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isEditing) {
    // Read-only view
    return (
      <div className="space-y-3">
        <div className="bg-white rounded-lg border-2 border-gray-200 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <Search className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" aria-hidden="true" />
            <div className="flex-1">
              <label className="text-sm font-semibold text-gray-700 block mb-1">You searched for:</label>
              <h2 className="text-lg font-medium text-gray-900" aria-label="Current search query">{initialQuery}</h2>

              {/* Active Filters Display */}
              {(initialCategories.length > 0 || initialResourceTypes.length > 0 || initialLocation) && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                    <FileText className="w-4 h-4" aria-hidden="true" />
                    <span className="font-medium">Active Filters:</span>
                  </div>

                  <div className="text-sm text-gray-700" role="group" aria-label="Applied search filters">
                    {initialResourceTypes.length > 0 && (
                      <div>
                        <span className="font-medium">Categories:</span>{" "}
                        {initialResourceTypes.map(type => {
                          const resourceType = [...resourceProviderTypes, ...additionalResourceTypes].find(t => t.id === type);
                          return resourceType?.label;
                        }).filter(Boolean).join(", ")}
                      </div>
                    )}
                    {initialCategories.length > 0 && (
                      <div className="mt-1">
                        <span className="font-medium">Resources:</span>{" "}
                        {initialCategories.map(categoryId => {
                          const category = resourceCategories.find((c) => c.id === categoryId);
                          return category?.label;
                        }).filter(Boolean).join(", ")}
                      </div>
                    )}
                    {initialLocation && (
                      <div className="mt-1">
                        <span className="font-medium">Location:</span> {initialLocation}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Refine Search Section */}
        <div className="bg-blue-50 rounded-lg p-5 text-center border border-blue-200">
          <p className="text-gray-800 mb-3 font-medium">
            Not seeing the right results? Add more details to get better matches
          </p>
          <Button
            onClick={() => setIsEditing(true)}
            className="bg-blue-600 text-white hover:bg-blue-700 font-medium px-6 cursor-pointer"
            aria-label="Refine your search query and filters"
          >
            <Sparkles className="w-4 h-4 mr-2" aria-hidden="true" />
            Refine Search
          </Button>
        </div>
      </div>
    );
  }

  // Editing view
  return (
    <div className="bg-white rounded-lg border-2 border-blue-400 p-5 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-600" aria-hidden="true" />
          Refine your search to get better results
        </h3>
      </div>

      <div className="space-y-6">
        {/* Query Input */}
        <div>
          <label htmlFor="search-query-input" className="text-sm font-semibold text-gray-700 block mb-2">
            Update your search:
          </label>
          <Textarea
            id="search-query-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your client's needs..."
            className="min-h-[100px] text-base bg-white border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            autoFocus
            aria-describedby="query-help-text"
          />
          <p id="query-help-text" className="text-sm text-gray-600 mt-2 flex items-center gap-1">
            <Lightbulb className="w-4 h-4" aria-hidden="true" />
            Be specific: Include client's situation, barriers they face, location, timeline, and any special circumstances
          </p>
        </div>

        {/* Adjust Filters Section */}
        <div>
          <h4 className="font-semibold text-gray-900 mb-3">Adjust Filters:</h4>
          <p className="text-sm text-gray-600 mb-4">Select categories to refine your search</p>

          {/* Main Resource Provider Types */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            {resourceProviderTypes.map((type) => {
              const Icon = type.icon;
              const isSelected = selectedResourceTypes.includes(type.id);
              return (
                <button
                  key={type.id}
                  onClick={() => toggleResourceType(type.id)}
                  className={`p-4 rounded-lg border-2 transition-all text-left cursor-pointer ${
                    isSelected
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Icon className={`w-5 h-5 mt-0.5 ${isSelected ? "text-blue-600" : "text-gray-600"}`} />
                    <div>
                      <div className={`font-semibold text-sm ${isSelected ? "text-blue-900" : "text-gray-900"}`}>
                        {type.label}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">{type.description}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Additional Resource Types */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {additionalResourceTypes.map((type) => {
              const Icon = type.icon;
              const isSelected = selectedResourceTypes.includes(type.id);
              return (
                <button
                  key={type.id}
                  onClick={() => toggleResourceType(type.id)}
                  className={`p-4 rounded-lg border-2 transition-all text-left cursor-pointer ${
                    isSelected
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Icon className={`w-5 h-5 mt-0.5 ${isSelected ? "text-blue-600" : "text-gray-600"}`} />
                    <div>
                      <div className={`font-semibold text-sm ${isSelected ? "text-blue-900" : "text-gray-900"}`}>
                        {type.label}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">{type.description}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sub-categories (shown when community is selected) */}
        {selectedResourceTypes.includes("community") && (
          <div>
            <h4 className="font-semibold text-gray-900 mb-3">Refine with sub-categories</h4>
            <p className="text-sm text-gray-700 mb-3">Local Community Resources</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {communitySubcategories.map((subcategory) => {
                const Icon = subcategory.icon;
                const isSelected = selectedSubcategories.includes(subcategory.id);
                return (
                  <button
                    key={subcategory.id}
                    onClick={() => toggleSubcategory(subcategory.id)}
                    className={`p-3 rounded-lg border transition-all text-left cursor-pointer ${
                      isSelected
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <Icon className={`w-4 h-4 mt-0.5 ${isSelected ? "text-blue-600" : "text-gray-600"}`} />
                      <div>
                        <div className={`font-medium text-sm ${isSelected ? "text-blue-900" : "text-gray-900"}`}>
                          {subcategory.label}
                        </div>
                        <div className="text-xs text-gray-600 mt-0.5">{subcategory.description}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Location Preferences */}
        <div>
          <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-600" />
            Location Preferences
          </h4>
          <p className="text-sm text-gray-600 mb-3">Optional: Specify a location to find resources nearby.</p>
          <Input
            placeholder="Enter location (city, ZIP code, area, etc.)"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="border-gray-300 bg-white focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
            <Lightbulb className="w-3 h-3" />
            Examples: "Round Rock", "78701", "Austin, TX", "San Marcos"
          </p>
        </div>

        {/* Active Filters Display */}
        {(selectedResourceTypes.length > 0 || selectedCategories.length > 0 || selectedSubcategories.length > 0) && (
          <div className="pt-4 border-t border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-600" aria-hidden="true" />
              Active Filters:
            </h4>
            <div className="text-sm text-gray-700">
              {selectedResourceTypes.length > 0 && (
                <div>
                  <span className="font-medium">Categories:</span>{" "}
                  {selectedResourceTypes.map(type => {
                    const resourceType = [...resourceProviderTypes, ...additionalResourceTypes].find(t => t.id === type);
                    return resourceType?.label;
                  }).filter(Boolean).join(", ")}
                </div>
              )}
              {selectedCategories.length > 0 && (
                <div className="mt-1">
                  <span className="font-medium">Resources:</span>{" "}
                  {selectedCategories.map(categoryId => {
                    const category = resourceCategories.find((c) => c.id === categoryId);
                    return category?.label;
                  }).filter(Boolean).join(", ")}
                </div>
              )}
              {selectedSubcategories.length > 0 && (
                <div className="mt-1">
                  <span className="font-medium">Sub-categories:</span>{" "}
                  {selectedSubcategories.map(id => {
                    const sub = communitySubcategories.find(s => s.id === id);
                    return sub?.label;
                  }).filter(Boolean).join(", ")}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600" aria-label="Keyboard shortcut">
            Press <kbd className="px-1.5 py-0.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-300 rounded">⌘</kbd> + <kbd className="px-1.5 py-0.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-300 rounded">Enter</kbd> to search
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleCancel}
              className="border-gray-300 hover:bg-gray-50 font-medium cursor-pointer"
              aria-label="Cancel editing and close"
            >
              <X className="w-4 h-4 mr-2" aria-hidden="true" />
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!hasChanges}
              className={`font-medium px-6 ${hasChanges ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
              aria-label={hasChanges ? "Search with updated query and filters" : "No changes made to search"}
              aria-disabled={!hasChanges}
            >
              <Search className="w-4 h-4 mr-2" aria-hidden="true" />
              Get Better Results
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}