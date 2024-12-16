"use client";
import React, { useState, useEffect } from "react";
import {
  DollarSign,
  Bitcoin,
  Trash2,
  Play,
  RefreshCw,
  ArrowDown,
  Send,
  Repeat,
  GripHorizontal,
} from "lucide-react";

interface BlockType {
  id: string;
  name: string;
  icon: React.ElementType;
  color: string;
  geckoId?: string;
  category: "currency" | "action";
  description?: string;
}

interface PathNode {
  id: number;
  type: string;
  amount?: string;
  category: "currency" | "action";
}

interface ExecutionResult {
  type: string;
  details: {
    fromAmount?: string;
    fromCurrency?: string;
    toCurrency?: string;
    toAmount?: string;
    rate?: number;
  };
  timestamp: number;
}

const PathBuilder = () => {
  const [path, setPath] = useState<PathNode[]>([]);
  const [prices, setPrices] = useState<Record<string, { usd: number }>>({});
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResults, setExecutionResults] = useState<ExecutionResult[]>(
    []
  );
  const [selectedCategory, setSelectedCategory] = useState<
    "currency" | "action"
  >("currency");
  const [draggedItem, setDraggedItem] = useState<BlockType | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const actionTypes: BlockType[] = [
    {
      id: "convert",
      name: "Convert",
      icon: Repeat,
      color: "bg-purple-500",
      category: "action",
      description: "Convert between currencies",
    },
    {
      id: "send",
      name: "Send",
      icon: Send,
      color: "bg-indigo-500",
      category: "action",
      description: "Send to address",
    },
  ];

  const currencyTypes: BlockType[] = [
    {
      id: "usd",
      name: "USD",
      icon: DollarSign,
      color: "bg-green-500",
      geckoId: "usd",
      category: "currency",
    },
    {
      id: "eth",
      name: "ETH",
      icon: Bitcoin,
      color: "bg-blue-500",
      geckoId: "ethereum",
      category: "currency",
    },
    {
      id: "btc",
      name: "BTC",
      icon: Bitcoin,
      color: "bg-orange-500",
      geckoId: "bitcoin",
      category: "currency",
    },
  ];
  const handleDragStart = (block: BlockType) => {
    setDraggedItem(block);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (!draggedItem) return;

    const newNode: PathNode = {
      id: Date.now(),
      type: draggedItem.id,
      amount: path.length === 0 ? "" : undefined,
      category: draggedItem.category,
    };

    const newPath = [...path];
    newPath.splice(index, 0, newNode);
    setPath(newPath);
    setDraggedItem(null);
    setDragOverIndex(null);
  };
  const fetchPrices = async () => {
    try {
      const currencies = currencyTypes
        .filter((ct) => ct.geckoId !== "usd")
        .map((ct) => ct.geckoId)
        .join(",");

      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${currencies}&vs_currencies=usd`
      );
      const data = await response.json();
      setPrices(data);
    } catch (error) {
      console.error("Error fetching prices:", error);
    }
  };

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, []);

  const calculateConversion = (
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): number => {
    if (fromCurrency === "usd") {
      return (
        amount /
        (prices[currencyTypes.find((ct) => ct.id === toCurrency)?.geckoId!]
          ?.usd || 1)
      );
    } else if (toCurrency === "usd") {
      return (
        amount *
        (prices[currencyTypes.find((ct) => ct.id === fromCurrency)?.geckoId!]
          ?.usd || 1)
      );
    } else {
      const fromRate =
        prices[currencyTypes.find((ct) => ct.id === fromCurrency)?.geckoId!]
          ?.usd || 1;
      const toRate =
        prices[currencyTypes.find((ct) => ct.id === toCurrency)?.geckoId!]
          ?.usd || 1;
      return (amount * fromRate) / toRate;
    }
  };

  const executePathNode = async (
    node: PathNode,
    prevNode?: PathNode,
    nextNode?: PathNode
  ): Promise<ExecutionResult> => {
    switch (node.type) {
      case "convert":
        if (!prevNode || !nextNode) {
          throw new Error("Convert requires previous and next nodes");
        }
        const amount = parseFloat(prevNode.amount || "0");
        const convertedAmount = calculateConversion(
          amount,
          prevNode.type,
          nextNode.type
        );

        return {
          type: "convert",
          details: {
            fromAmount: amount.toString(),
            fromCurrency: prevNode.type.toUpperCase(),
            toCurrency: nextNode.type.toUpperCase(),
            toAmount: convertedAmount.toFixed(6),
            rate: calculateConversion(1, prevNode.type, nextNode.type),
          },
          timestamp: Date.now(),
        };

      case "send":
        if (!prevNode) {
          throw new Error("Send requires a previous node");
        }
        return {
          type: "send",
          details: {
            fromAmount: prevNode.amount,
            fromCurrency: prevNode.type.toUpperCase(),
          },
          timestamp: Date.now(),
        };

      default:
        return {
          type: "unknown",
          details: {},
          timestamp: Date.now(),
        };
    }
  };

  const executePath = async () => {
    setIsExecuting(true);
    setExecutionResults([]);
    const results: ExecutionResult[] = [];

    try {
      await fetchPrices();
      for (let i = 0; i < path.length; i++) {
        const node = path[i];
        if (node.category === "action") {
          const result = await executePathNode(node, path[i - 1], path[i + 1]);
          results.push(result);
          if (node.type === "convert" && path[i + 1]) {
            const newPath = [...path];
            newPath[i + 1] = {
              ...path[i + 1],
              amount: result.details.toAmount,
            };
            setPath(newPath);
          }
        }
      }

      setExecutionResults(results);
    } catch (error) {
      console.error("Error executing path:", error);
    } finally {
      setIsExecuting(false);
    }
  };
  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Build Your Path
          </h2>

          <div className="bg-white rounded-lg p-6 shadow-md">
            <div className="flex gap-4 mb-4">
              <button
                onClick={() => setSelectedCategory("currency")}
                className={`px-4 py-2 rounded-lg font-medium ${
                  selectedCategory === "currency"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                Currencies
              </button>
              <button
                onClick={() => setSelectedCategory("action")}
                className={`px-4 py-2 rounded-lg font-medium ${
                  selectedCategory === "action"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                Actions
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {(selectedCategory === "currency"
                ? currencyTypes
                : actionTypes
              ).map((block) => (
                <div
                  key={block.id}
                  draggable
                  onDragStart={() => handleDragStart(block)}
                  className={`${block.color} text-white p-4 rounded-lg flex items-center gap-2 cursor-move hover:opacity-90 transition-opacity`}
                >
                  <GripHorizontal size={16} className="text-white/60" />
                  <block.icon size={20} />
                  <span className="font-medium">{block.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg p-6 shadow-md mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Path</h2>
          <div
            className="min-h-[200px] border-2 border-dashed border-gray-200 rounded-lg p-4"
            onDragOver={(e) => {
              e.preventDefault();
              if (path.length === 0) setDragOverIndex(0);
            }}
            onDrop={(e) => handleDrop(e, path.length)}
          >
            {path.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                Drag blocks here to build your path
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {path.map((node, index) => {
                  const nodeType = [...currencyTypes, ...actionTypes].find(
                    (t) => t.id === node.type
                  );
                  if (!nodeType) return null;

                  return (
                    <div
                      key={node.id}
                      className={`relative flex items-center gap-2 ${
                        dragOverIndex === index ? "mb-8" : ""
                      }`}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDrop={(e) => handleDrop(e, index)}
                    >
                      <div
                        className={`
                        ${
                          nodeType.color
                        } text-white p-4 rounded-lg flex items-center gap-2 min-w-[200px]
                        ${
                          dragOverIndex === index
                            ? "transform translate-y-2"
                            : ""
                        }
                      `}
                      >
                        <nodeType.icon size={20} />
                        <div className="flex-1">
                          {index === 0 && node.category === "currency" ? (
                            <input
                              type="number"
                              value={node.amount || ""}
                              onChange={(e) => {
                                const newPath = [...path];
                                newPath[index] = {
                                  ...node,
                                  amount: e.target.value,
                                };
                                setPath(newPath);
                              }}
                              className="bg-transparent border-b border-white/50 focus:border-white outline-none w-full text-white placeholder-white/70"
                              placeholder={`Enter ${nodeType.name} amount`}
                            />
                          ) : (
                            <span className="font-medium">{nodeType.name}</span>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            const newPath = [...path];
                            newPath.splice(index, 1);
                            setPath(newPath);
                          }}
                          className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1 hover:bg-red-600"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      {index < path.length - 1 && (
                        <div className="w-8 flex justify-center">
                          <ArrowDown size={24} className="text-gray-400" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={executePath}
            disabled={path.length < 2 || isExecuting}
            className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
          >
            <Play size={20} />
            {isExecuting ? "Executing..." : "Execute Path"}
          </button>
          <button
            onClick={() => {}}
            className="bg-gray-500 text-white p-3 rounded-lg hover:bg-gray-600"
          >
            <RefreshCw size={20} />
          </button>
        </div>
        {executionResults.length > 0 && (
          <div className="mt-8 bg-white rounded-lg p-6 shadow-md">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Execution Results
            </h2>
            <div className="flex flex-col gap-4">
              {executionResults.map((result, index) => (
                <div key={index} className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      {result.type === "convert" && (
                        <>
                          <div className="font-medium text-gray-800">
                            {result.details.fromAmount}{" "}
                            {result.details.fromCurrency} →{" "}
                            {result.details.toAmount}{" "}
                            {result.details.toCurrency}
                          </div>
                          <div className="text-sm text-gray-600">
                            Rate: 1 {result.details.fromCurrency} ={" "}
                            {result.details.rate?.toFixed(6)}{" "}
                            {result.details.toCurrency}
                          </div>
                        </>
                      )}
                      {result.type === "send" && (
                        <div className="font-medium text-gray-800">
                          Send {result.details.fromAmount}{" "}
                          {result.details.fromCurrency}
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(result.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PathBuilder;
