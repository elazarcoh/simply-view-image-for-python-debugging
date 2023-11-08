import socket
import traceback
import struct
import numpy as np

# See SocketSerialization.ts for message format
# MessageType 
PythonSendingObject = 0x01
# ObjectType
NumpyArray = 0x01
ExceptionObject = 0xff
# ArrayDataType
Float32 = 0x01
Float64 = 0x02
Int8 = 0x03
Int16 = 0x04
Int32 = 0x05
Int64 = 0x06
Uint8 = 0x07
Uint16 = 0x08
Uint32 = 0x09
Uint64 = 0x0a
Bool = 0x0b
# ExceptionType
ExceptionTypes = {
    BaseException: 0x01,
    Exception: 0x02,
    RuntimeError: 0x03,
    TypeError: 0x04,
    ValueError: 0x05,
    None: 0xff,  # Unknown exception
}

MessageType = np.uint8
RequestIdType = np.uint32
ObjectIdType = np.uint32
ObjectType = np.uint8
NumDimsType = np.uint8
DimType = np.uint32

array_dtype_to_array_data_type = {
    "float32": Float32,
    "float64": Float64,
    "int8": Int8,
    "int16": Int16,
    "int32": Int32,
    "int64": Int64,
    "uint8": Uint8,
    "uint16": Uint16,
    "uint32": Uint32,
    "uint64": Uint64,
    "bool": Bool,
    "bool_": Bool,
}


def create_numpy_message(
    request_id: RequestIdType,
    array: np.ndarray,
):
    # Create the message header
    message_type = MessageType(PythonSendingObject)
    request_id = RequestIdType(request_id)
    object_id = ObjectIdType(id(array))
    object_type = ObjectType(NumpyArray)

    # Create the message body
    array_dtype =   array_dtype_to_array_data_type[str(array.dtype)]
    num_dimensions = NumDimsType(len(array.shape))
    array_shape =   np.array(array.shape, dtype=DimType)
    array_data =    array.tobytes()

    # Create the message
    message = [
        message_type,
        request_id,
        object_id,
        object_type,
        array_dtype,
        num_dimensions,
        *array_shape,
        array_data,
    ]

    # Create the message format string
    message_format = f'>BIIBBB{num_dimensions}I{len(array_data)}s'

    # Pack the message
    message_pack = struct.pack(message_format, *message)

    return message_pack

def create_exception_message(
    request_id: RequestIdType,
    exception: Exception,
):
    # Create the message header
    message_type = MessageType(PythonSendingObject)
    request_id = RequestIdType(request_id)
    object_id = ObjectIdType(id(exception))
    object_type = ObjectType(ExceptionObject)

    # Create the message body
    exception_type = ExceptionTypes.get(type(exception), ExceptionTypes[None])
    exception_message = traceback.format_exc().encode()
    
    # Create the message
    message = [
        message_type,
        request_id,
        object_id,
        object_type,
        exception_type,
        exception_message,
    ]

    # Create the message format string
    message_format = f'>BIIBB{len(exception_message)}s'

    # Pack the message
    message_pack = struct.pack(message_format, *message)

    return message_pack

def open_send_and_close(port, request_id, array):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.connect(('localhost', port))

        try:
            message = create_numpy_message(request_id, array)
        except Exception as e:
            message = create_exception_message(request_id, e)
        
        # Send the message length (4 bytes, big-endian)
        msg_len = struct.pack('>I', len(message))
        s.sendall(msg_len)

        # Send the message data
        s.sendall(message)

        # Close the socket
        s.close()