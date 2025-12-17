import { FileText, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Resource } from "@/types/resources";
import { ActionPlan } from "@/util/fetchActionPlan";
import { ActionPlanDisplay } from "@/components/ActionPlanDisplay";

interface ActionPlanSectionProps {
  resources: Resource[];
  selectedResources: Resource[];
  actionPlan: ActionPlan | null;
  isGeneratingActionPlan: boolean;
  streamingContent?: string;
  isStreaming?: boolean;
  actionPlanError?: string;
  onResourceSelection: (resource: Resource, checked: boolean) => void;
  onSelectAllResources: () => void;
  onGenerateActionPlan: () => void;
}

export function ActionPlanSection({
  resources,
  selectedResources,
  actionPlan,
  isGeneratingActionPlan,
  streamingContent,
  isStreaming,
  actionPlanError,
  onResourceSelection,
  onSelectAllResources,
  onGenerateActionPlan,
}: ActionPlanSectionProps) {
  return (
    <>
      {/* Action Plan Section */}
      <Card className="bg-white shadow-sm mb-5">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Select Resources for Action Plan
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={onSelectAllResources}
              className="text-xs"
            >
              {selectedResources.length === resources.length
                ? "Deselect All"
                : "Select All"}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {resources.map((resource, index) => (
              <div key={index} className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id={`resource-${index}`}
                  className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  onChange={(e) =>
                    onResourceSelection(resource, e.target.checked)
                  }
                  checked={selectedResources.some(
                    (r) => r.name === resource.name,
                  )}
                />
                <label
                  htmlFor={`resource-${index}`}
                  className="flex-1 cursor-pointer"
                >
                  <div className="font-medium text-gray-900">
                    {resource.name}
                  </div>
                  {resource.description && (
                    <div className="text-sm text-gray-600">
                      {resource.description}
                    </div>
                  )}
                </label>
              </div>
            ))}
          </div>
          {selectedResources.length > 0 && (
            <div className="mt-4 pt-3 border-t">
              <Button
                onClick={onGenerateActionPlan}
                disabled={isGeneratingActionPlan}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {!isGeneratingActionPlan && (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    Generate Action Plan ({selectedResources.length} selected)
                  </>
                )}
                {isGeneratingActionPlan && (
                  <>
                    <Spinner />
                    Generating Action Plan...
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Plan Error */}
      {actionPlanError && !isStreaming && !actionPlan && (
        <Card className="bg-red-50 border-red-200 shadow-sm mb-5">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-red-900 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" aria-hidden="true" />
              Unable to Generate Action Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-800 mb-3">
              We encountered an issue while creating your action plan. This may
              be due to a temporary server issue or network problem.
            </p>
            <p className="text-red-700 text-sm">
              Please try again. If the problem persists, try selecting fewer
              resources or refreshing the page.
            </p>
            <Button
              onClick={onGenerateActionPlan}
              variant="outline"
              className="mt-4 border-red-300 text-red-700 hover:bg-red-100 cursor-pointer"
              aria-label="Retry generating action plan"
            >
              <FileText className="w-4 h-4 mr-2" aria-hidden="true" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Action Plan Display */}
      {(actionPlan || isStreaming) && (
        <ActionPlanDisplay
          actionPlan={actionPlan}
          streamingContent={streamingContent}
          isStreaming={isStreaming}
        />
      )}
    </>
  );
}
