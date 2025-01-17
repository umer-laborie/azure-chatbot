import React, { useState, useEffect } from "react";
import styles from "./file-viewer.module.css";

type File = {
	id: string;
	name: string;
	type: "folder" | "file";
};

type ExpandedFolders = {
	[key: string]: File[];
};

type SelectedFiles = {
	[key: string]: File;
};

const SharepointFileViewer: React.FC = () => {
	const [files, setFiles] = useState<File[]>([]);
	const [expandedFolders, setExpandedFolders] = useState<ExpandedFolders>({});
	const [selectedFiles, setSelectedFiles] = useState<SelectedFiles>({});

	useEffect(() => {
		const loadRootFiles = async () => {
			const rootFiles = await fetchFiles();
			setFiles(rootFiles);
		};
		loadRootFiles();
	}, []);

	const fetchFiles = async (folderId: string = "root"): Promise<File[]> => {
		try {
			const resp = await fetch(`/api/sharepoint-folder?folderId=${folderId}`, {
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				},
			});
			const data: File[] = await resp.json();
			return data;
		} catch (error) {
			console.error("Error fetching files:", error);
			return [];
		}
	};

	const handleFolderToggle = async (folder: File) => {
		if (expandedFolders[folder.id]) {
			// Collapse folder
			setExpandedFolders((prev) => {
				const updated = { ...prev };
				delete updated[folder.id];
				return updated;
			});
		} else {
			// Expand folder and fetch contents
			const contents = await fetchFiles(folder.id);
			setExpandedFolders((prev) => ({
				...prev,
				[folder.id]: contents,
			}));
		}
	};

	useEffect(() => {
		console.log("selectedFiles", selectedFiles);
	}, [selectedFiles]);

	const handleCheckboxChange = async (file: File) => {
		const isSelected = selectedFiles[file.id];

		if (isSelected) {
			setSelectedFiles((prev) => {
				const updated = { ...prev };
				delete updated[file.id];
				return updated;
			});
		} else {
			setSelectedFiles((prev) => ({
				...prev,
				[file.id]: file,
			}));

			try {
				await uploadFileToOpenAI(file);
			} catch (error) {
				console.error(`Error uploading file ${file.name}:`, error);
				setSelectedFiles((prev) => {
					const updated = { ...prev };
					delete updated[file.id];
					return updated;
				});
			}
		}
	};

	const uploadFileToOpenAI = async (file: File) => {
		try {
			console.log("file to upload", file);

			const response = await fetch(`/api/sharepoint-file-content?fileId=${file.id}`);
			const fileContent = await response.blob();

			const formData = new FormData();
			formData.append("file", fileContent, file.name);

			const openAIResponse = await fetch(`/api/upload-from-sharepoint`, {
				method: "POST",
				body: formData,
			});

			if (!openAIResponse.ok) {
				console.error(`Failed to upload file: ${file.name}`);
			} else {
				console.log(`Successfully uploaded: ${file.name}`);
			}
		} catch (error) {
			console.error(`Error uploading file ${file.name}:`, error);
		}
	};

	const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const data = new FormData();
		if (!event.target.files || event.target.files.length === 0) return;
		console.log(event.target.files);

		for (const file of Array.from(event.target.files)) {
			data.append("files", file);
		}

		const fileIds = files.map((file) => file.id);
		data.append("fileIds", JSON.stringify(fileIds));

		await fetch(`/api/assistants/files`, {
			method: "POST",
			body: data,
		});
	};

	const renderItems = (items: File[]) => {
		return items.map((item) => (
			<div key={item.id} style={{ marginLeft: item.type === "folder" ? 20 : 40 }}>
				{item.type === "folder" ? (
					<div>
						<span
							onClick={() => handleFolderToggle(item)}
							style={{ cursor: "pointer", fontWeight: "bold" }}
						>
							📁 {item.name}
						</span>
						{expandedFolders[item.id] && (
							<div>{renderItems(expandedFolders[item.id])}</div>
						)}
					</div>
				) : (
					<div>
						<label>
							<input
								type="checkbox"
								checked={!!selectedFiles[item.id]}
								onChange={() => handleCheckboxChange(item)}
							/>
							📄 {item.name}
						</label>
					</div>
				)}
			</div>
		));
	};

	return (
		<div className={styles.fileViewer}>
			<div
				className={`${styles.filesList} ${files.length !== 0 ? styles.grow : ""}`}
				style={{ alignItems: "flex-start" }}
			>
				{renderItems(files)}
			</div>
		</div>
	);
};

export default SharepointFileViewer;
