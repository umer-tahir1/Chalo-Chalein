import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { fetchServer } from "../utils/supabase";
import { toast } from "sonner";
import { Loader2, Mail, Lock, User, CarFront, Bike, Car, House, Phone, Upload } from "lucide-react";

type Role = "passenger" | "driver";

type UploadKind = "cnicFront" | "cnicBack" | "license" | "vehicleFront" | "vehicleBack";

interface SelectedFile {
  file: File | null;
  previewUrl: string;
  uploadedPath: string;
  uploadedSignedUrl: string;
}

const ALLOWED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;

const defaultFileState = (): SelectedFile => ({
  file: null,
  previewUrl: "",
  uploadedPath: "",
  uploadedSignedUrl: "",
});

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.split(",")[1] || "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function SignupPage() {
  const [searchParams] = useSearchParams();
  const initRole = searchParams.get("role") === "driver" ? "driver" : "passenger";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>(initRole);
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [driverVehicleType, setDriverVehicleType] = useState("bike");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseExpiry, setLicenseExpiry] = useState("");

  const [files, setFiles] = useState<Record<UploadKind, SelectedFile>>({
    cnicFront: defaultFileState(),
    cnicBack: defaultFileState(),
    license: defaultFileState(),
    vehicleFront: defaultFileState(),
    vehicleBack: defaultFileState(),
  });

  const navigate = useNavigate();

  useEffect(() => {
    setRole(searchParams.get("role") === "driver" ? "driver" : "passenger");
  }, [searchParams]);

  const setSelectedFile = (kind: UploadKind, file: File | null) => {
    if (!file) {
      setFiles((prev) => ({
        ...prev,
        [kind]: defaultFileState(),
      }));
      return;
    }

    if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) {
      toast.error("Only JPG, PNG, WEBP, and PDF files are allowed");
      return;
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      toast.error("Each file must be 5MB or smaller");
      return;
    }

    const previewUrl = file.type === "application/pdf" ? "" : URL.createObjectURL(file);
    setFiles((prev) => ({
      ...prev,
      [kind]: {
        ...defaultFileState(),
        file,
        previewUrl,
      },
    }));
  };

  const uploadOneFile = async (kind: UploadKind, userFile: File) => {
    const fileBase64 = await fileToBase64(userFile);
    const res = await fetchServer("/uploads/document", {
      method: "POST",
      body: JSON.stringify({
        fileName: userFile.name,
        mimeType: userFile.type,
        fileBase64,
        category: kind,
      }),
    });

    return {
      path: res.path as string,
      signedUrl: res.signedUrl as string,
    };
  };

  const uploadDriverDocsIfNeeded = async () => {
    if (role !== "driver") return;

    const requiredKinds: UploadKind[] = ["cnicFront", "cnicBack", "license", "vehicleFront", "vehicleBack"];
    for (const kind of requiredKinds) {
      if (!files[kind].file) {
        throw new Error("All onboarding documents are required for drivers");
      }
    }

    const nextFiles = { ...files };
    for (const kind of requiredKinds) {
      const uploaded = await uploadOneFile(kind, files[kind].file as File);
      nextFiles[kind] = {
        ...files[kind],
        uploadedPath: uploaded.path,
        uploadedSignedUrl: uploaded.signedUrl,
      };
    }
    setFiles(nextFiles);

    return {
      cnicFrontUrl: nextFiles.cnicFront.uploadedSignedUrl,
      cnicBackUrl: nextFiles.cnicBack.uploadedSignedUrl,
      licenseUrl: nextFiles.license.uploadedSignedUrl,
      vehiclePhotos: [nextFiles.vehicleFront.uploadedSignedUrl, nextFiles.vehicleBack.uploadedSignedUrl],
      documentPaths: {
        cnicFrontPath: nextFiles.cnicFront.uploadedPath,
        cnicBackPath: nextFiles.cnicBack.uploadedPath,
        licensePath: nextFiles.license.uploadedPath,
        vehicleFrontPath: nextFiles.vehicleFront.uploadedPath,
        vehicleBackPath: nextFiles.vehicleBack.uploadedPath,
      },
    };
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const uploadedDocs = await uploadDriverDocsIfNeeded();

      const response = await fetchServer("/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          name,
          role,
          phone,
          address,
          vehicleDetails: role === "driver" ? {
            type: driverVehicleType,
            registrationNumber: vehicleNumber,
          } : null,
          driverVerification: role === "driver" ? {
            cnicFrontUrl: uploadedDocs?.cnicFrontUrl,
            cnicBackUrl: uploadedDocs?.cnicBackUrl,
            licenseUrl: uploadedDocs?.licenseUrl,
            licenseNumber,
            licenseExpiry,
            vehiclePhotos: uploadedDocs?.vehiclePhotos,
            documentPaths: uploadedDocs?.documentPaths,
          } : null,
        }),
      });

      if (response.error) {
        throw new Error(response.error);
      }

      toast.success("Account created. Verify your email, then log in.");
      navigate("/login");
    } catch (error: any) {
      toast.error(error.message || "Failed to sign up");
    } finally {
      setLoading(false);
    }
  };

  const fileCard = (kind: UploadKind, label: string) => {
    const selected = files[kind];
    return (
      <div className="rounded-lg border border-neutral-200 p-2.5">
        <label className="text-xs font-medium text-neutral-700 block mb-1.5">{label}</label>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          onChange={(e) => setSelectedFile(kind, e.target.files?.[0] || null)}
          className="w-full text-xs"
        />
        {selected.file && (
          <div className="mt-2 text-[11px] text-neutral-600">
            <p className="truncate">{selected.file.name}</p>
            <p>{Math.round(selected.file.size / 1024)} KB</p>
          </div>
        )}
        {selected.previewUrl && (
          <img src={selected.previewUrl} alt={label} className="mt-2 h-20 w-full object-cover rounded-md border border-neutral-200" />
        )}
        {selected.file?.type === "application/pdf" && (
          <div className="mt-2 text-[11px] text-blue-700">PDF selected</div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-neutral-50">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-sm border border-neutral-200">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-neutral-900">Create an account</h2>
          <p className="mt-2 text-center text-sm text-neutral-600">
            Already have an account? <Link to="/login" className="font-medium text-green-600 hover:text-green-500">Log in instead</Link>
          </p>
        </div>

        <div className="flex bg-neutral-100 p-1 rounded-lg mt-8">
          <button
            type="button"
            onClick={() => setRole("passenger")}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${role === "passenger" ? "bg-white text-green-700 shadow-sm" : "text-neutral-500 hover:text-neutral-700"}`}
          >
            Passenger
          </button>
          <button
            type="button"
            onClick={() => setRole("driver")}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${role === "driver" ? "bg-white text-green-700 shadow-sm" : "text-neutral-500 hover:text-neutral-700"}`}
          >
            Driver
          </button>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSignup}>
          <div className="space-y-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><User className="h-5 w-5 text-neutral-400" /></div>
              <input id="name" type="text" required className="appearance-none block w-full px-3 py-3 pl-10 border border-neutral-300 rounded-md placeholder-neutral-500 text-neutral-900 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Phone className="h-5 w-5 text-neutral-400" /></div>
              <input id="phone" type="tel" required className="appearance-none block w-full px-3 py-3 pl-10 border border-neutral-300 rounded-md placeholder-neutral-500 text-neutral-900 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" placeholder="+92 3XX XXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><House className="h-5 w-5 text-neutral-400" /></div>
              <input id="address" type="text" required className="appearance-none block w-full px-3 py-3 pl-10 border border-neutral-300 rounded-md placeholder-neutral-500 text-neutral-900 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" placeholder="Address in Pakistan" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Mail className="h-5 w-5 text-neutral-400" /></div>
              <input id="email-address" type="email" autoComplete="email" required className="appearance-none block w-full px-3 py-3 pl-10 border border-neutral-300 rounded-md placeholder-neutral-500 text-neutral-900 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Lock className="h-5 w-5 text-neutral-400" /></div>
              <input id="password" type="password" autoComplete="new-password" required minLength={6} className="appearance-none block w-full px-3 py-3 pl-10 border border-neutral-300 rounded-md placeholder-neutral-500 text-neutral-900 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" placeholder="Password (min 6 chars)" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>

            {role === "driver" && (
              <div className="rounded-xl border border-neutral-200 p-3.5 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Driver onboarding verification</p>

                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setDriverVehicleType("bike")} className={`rounded-lg border px-3 py-2 text-xs font-medium flex items-center justify-center gap-1.5 ${driverVehicleType === "bike" ? "bg-green-50 border-green-300 text-green-700" : "border-neutral-200 text-neutral-600"}`}><Bike className="w-3.5 h-3.5" /> Bike</button>
                  <button type="button" onClick={() => setDriverVehicleType("car")} className={`rounded-lg border px-3 py-2 text-xs font-medium flex items-center justify-center gap-1.5 ${driverVehicleType === "car" ? "bg-green-50 border-green-300 text-green-700" : "border-neutral-200 text-neutral-600"}`}><Car className="w-3.5 h-3.5" /> Car</button>
                </div>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><CarFront className="h-4 w-4 text-neutral-400" /></div>
                  <input type="text" required className="appearance-none block w-full px-3 py-2.5 pl-9 border border-neutral-300 rounded-md placeholder-neutral-500 text-neutral-900 focus:outline-none focus:ring-green-500 focus:border-green-500 text-sm" placeholder="Vehicle registration number" value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} />
                </div>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Upload className="h-4 w-4 text-neutral-400" /></div>
                  <input type="text" required className="appearance-none block w-full px-3 py-2.5 pl-9 border border-neutral-300 rounded-md placeholder-neutral-500 text-neutral-900 focus:outline-none focus:ring-green-500 focus:border-green-500 text-sm" placeholder="Driving license number" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} />
                </div>

                <input type="date" required className="appearance-none block w-full px-3 py-2.5 border border-neutral-300 rounded-md text-neutral-900 focus:outline-none focus:ring-green-500 focus:border-green-500 text-sm" value={licenseExpiry} onChange={(e) => setLicenseExpiry(e.target.value)} />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {fileCard("cnicFront", "CNIC Front")}
                  {fileCard("cnicBack", "CNIC Back")}
                  {fileCard("license", "Driving License")}
                  {fileCard("vehicleFront", "Vehicle Photo Front")}
                  {fileCard("vehicleBack", "Vehicle Photo Side/Back")}
                </div>

                <p className="text-[11px] text-neutral-500">Documents are validated and uploaded securely. Driver profiles stay Pending until admin approval.</p>
              </div>
            )}
          </div>

          <button type="submit" disabled={loading} className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-70 transition-colors">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : role === "driver" ? <span className="flex items-center gap-2"><CarFront className="w-5 h-5" /> Sign Up as Driver</span> : "Sign Up"}
          </button>
        </form>
      </div>
    </div>
  );
}
