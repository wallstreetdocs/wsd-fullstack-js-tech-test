import { Parser } from 'json2csv';

export const exportToCSV = async (data) => {
  const parser = new Parser();
  return parser.parse(data);
};

export const exportToJSON = (data) => {
  return JSON.stringify(data, null, 2);
};
